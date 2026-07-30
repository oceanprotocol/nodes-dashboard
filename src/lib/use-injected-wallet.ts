import { CHAIN_ID } from '@/constants/chains';
import { getAddress } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Native (EOA) wallet connection, independent of Privy: EIP-6963 discovery + EIP-1193 calls.
 *
 * Invariant: we never expose an address on the wrong chain. That is also why the ethers
 * provider built from `eip1193` is never rebuilt — ethers binds `tx.wait()` to the instance
 * that sent the tx and caches the network, so swapping it mid-flight hangs an in-flight send.
 */

const STORAGE_KEY = 'ocean.auth';

/** `{ rdns }` reconnect that wallet · `'disconnected'` connect nothing · absent don't know yet. */
export type StoredAuth = { rdns: string } | 'disconnected';

export const readAuth = (): StoredAuth | undefined => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : undefined;
  } catch {
    return undefined;
  }
};

export const writeAuth = (value: StoredAuth) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {} // private mode / storage disabled — degrade to no persistence
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

export type DiscoveredWallet = {
  icon?: string;
  name: string;
  provider: Eip1193Provider;
  rdns: string;
};

const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

// Checksummed, not the lowercase EIP-1193 gives us: consumers match admin lists with a
// case-sensitive includes() and key localStorage by address.
const getAccounts = async (provider: Eip1193Provider, prompt: boolean): Promise<string | undefined> => {
  const accounts: string[] = await provider.request({ method: prompt ? 'eth_requestAccounts' : 'eth_accounts' });
  return accounts?.[0] ? getAddress(accounts[0]) : undefined;
};

const isOnAppChain = async (provider: Eip1193Provider) => {
  const chainId = await provider.request({ method: 'eth_chainId' });
  // eth_chainId is specified as hex, but wallets also return numbers and decimal strings.
  // Number() reads all three; parseInt(x, 16) mangles the latter.
  return Number(chainId) === CHAIN_ID;
};

/** Throws if the wallet does not end up on CHAIN_ID. */
const ensureAppChain = async (provider: Eip1193Provider) => {
  if (await isOnAppChain(provider)) return;
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
  // Some wallets resolve the switch optimistically, or before the user confirms.
  if (!(await isOnAppChain(provider))) {
    throw new Error(`Wallet is not on chain ${CHAIN_ID}`);
  }
};

const LEGACY_RDNS = 'injected';

/** @param canAutoAdopt false until the caller knows no smart account will claim this render. */
export function useInjectedWallet({ canAutoAdopt }: { canAutoAdopt: boolean }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [selected, setSelected] = useState<DiscoveredWallet | null>(null);
  const [address, setAddress] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Separate from `error` because it is toasted: it happens with every modal closed, whereas
  // connect errors already render inline in the wallet list.
  const [chainError, setChainError] = useState<string | undefined>();

  // EIP-6963 discovery. Keyed by rdns: StrictMode double-invokes this in dev and every
  // compliant wallet answers each requestProvider dispatch.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onAnnounce = (event: Event) => {
      const { info, provider } = (event as CustomEvent).detail ?? {};
      if (!info?.rdns || !provider) return;
      setWallets((current) => {
        const next = new Map(current.map((wallet) => [wallet.rdns, wallet]));
        next.delete(LEGACY_RDNS); // a late announcement supersedes the legacy placeholder
        next.set(info.rdns, { icon: info.icon, name: info.name, provider, rdns: info.rdns });
        // Sorted, or the chooser reshuffles between loads — announcement order is a race.
        return [...next.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
    };

    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Wallets that announce once before hydration are only reachable via the legacy global.
    // Only used when discovery found nothing: with several wallets installed one of them
    // proxies window.ethereum, so object identity can't tell it from an announced entry.
    // Deferred a macrotask so every announcement has landed first.
    const injected = (window as any).ethereum;
    const timer = injected
      ? setTimeout(() => {
          setWallets((current) =>
            current.length > 0 ? current : [{ name: 'Browser wallet', provider: injected, rdns: LEGACY_RDNS }]
          );
        }, 0)
      : undefined;

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      clearTimeout(timer);
    };
  }, []);

  // Silent boot reconnect. Never prompts, and never adopts an address on the wrong chain.
  useEffect(() => {
    if (selected || wallets.length === 0 || !canAutoAdopt) return;

    // Read here rather than trust a prop: disconnect() persists this before clearing
    // `selected`, so it holds even for the render in between.
    const stored = readAuth();
    if (stored === 'disconnected') return;

    // Remembered wallet first, else whichever holds window.ethereum — deterministic, and what
    // the app used before EIP-6963 discovery existed.
    const injected = (window as any).ethereum;
    const candidates = stored
      ? wallets.filter((wallet) => wallet.rdns === stored.rdns)
      : [...wallets].sort((a, b) => Number(b.provider === injected) - Number(a.provider === injected));

    let cancelled = false;
    // Reported as connecting: this window is async, and without it callers see
    // "not connected, not connecting" and prompt for a login that is already resolving.
    setIsConnecting(true);
    (async () => {
      try {
        for (const wallet of candidates) {
          try {
            const found = await getAccounts(wallet.provider, false);
            if (!found || !(await isOnAppChain(wallet.provider))) continue;
            if (cancelled) return;
            setSelected(wallet);
            setAddress(found);
            return;
          } catch {} // wallet locked or unreachable — try the next one
        }
      } finally {
        setIsConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canAutoAdopt, selected, wallets]);

  useEffect(() => {
    const provider = selected?.provider;
    if (!provider?.on) return;

    // Re-check the chain rather than trust the last known state: an account switch made on a
    // foreign chain would otherwise republish an address.
    const adoptIfOnAppChain = async () => {
      try {
        if (!(await isOnAppChain(provider))) {
          setAddress(undefined);
          setChainError(`Wrong network. Switch to chain ${CHAIN_ID} to continue.`);
          return;
        }
        setAddress(await getAccounts(provider, false));
        setChainError(undefined);
      } catch {
        setAddress(undefined);
      }
    };

    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts?.length) {
        setAddress(undefined);
        return;
      }
      adoptIfOnAppChain();
    };

    // Off our chain reads as disconnected; switching back must restore the address, since
    // `selected` stays set and the reconnect effect above won't fire again.
    const onChainChanged = () => adoptIfOnAppChain();

    provider.on('accountsChanged', onAccountsChanged);
    provider.on('chainChanged', onChainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('chainChanged', onChainChanged);
    };
  }, [selected]);

  const connect = useCallback(
    async (rdns: string) => {
      const wallet = wallets.find((candidate) => candidate.rdns === rdns);
      if (!wallet) return false;

      setIsConnecting(true);
      setError(undefined);
      try {
        const found = await getAccounts(wallet.provider, true);
        if (!found) throw new Error('No account returned by the wallet');
        await ensureAppChain(wallet.provider);
        setSelected(wallet);
        setAddress(found);
        setChainError(undefined);
        writeAuth({ rdns });
        return true;
      } catch (err: any) {
        setError(err?.message ?? 'Failed to connect');
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [wallets]
  );

  const disconnect = useCallback(async () => {
    writeAuth('disconnected');
    try {
      await selected?.provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
    } catch {} // MetaMask-only; other wallets keep the grant, hence the stored record
    setAddress(undefined);
    setSelected(null);
    setError(undefined);
    setChainError(undefined);
  }, [selected]);

  return useMemo(
    () => ({
      address,
      chainError,
      connect,
      disconnect,
      // Withheld on the wrong chain so no write path reaches a signer while we report
      // disconnected; `selected` is kept internally so we can recover.
      eip1193: chainError ? undefined : selected?.provider,
      error,
      isConnecting,
      wallets,
    }),
    [address, chainError, connect, disconnect, error, isConnecting, selected, wallets]
  );
}
