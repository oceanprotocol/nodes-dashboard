import { getEmbeddedWallet } from '@/lib/embedded-wallet';
import { alchemyWalletTransport, createSmartWalletClient, type SmartWalletClient } from '@alchemy/wallet-apis';
import { toViemAccount, useWallets } from '@privy-io/react-auth';
import { useEffect, useMemo, useState } from 'react';
import type { LocalAccount } from 'viem';
import { base, sepolia } from 'viem/chains';

type Call = { to: `0x${string}`; data?: `0x${string}`; value?: bigint };

const chain = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : sepolia;

function useAlchemyClient(): { client: SmartWalletClient | null; accountAddress?: `0x${string}` } {
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedWallet(wallets);
  const [signer, setSigner] = useState<LocalAccount | undefined>();
  const [accountAddress, setAccountAddress] = useState<`0x${string}` | undefined>();

  useEffect(() => {
    if (!embeddedWallet) {
      setSigner(undefined);
      return;
    }
    toViemAccount({ wallet: embeddedWallet }).then((s) => setSigner(s as unknown as LocalAccount));
  }, [embeddedWallet]);

  const client = useMemo((): SmartWalletClient | null => {
    if (!signer) return null;
    return createSmartWalletClient({
      signer,
      transport: alchemyWalletTransport({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY! }),
      chain,
      paymaster: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID
        ? { policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID }
        : undefined,
    });
  }, [signer]);

  // wallet-apis defaults to EIP-7702 (account == signer EOA), but Alchemy users' funds live in
  // their existing smart contract account. Resolve that account for the signer and use it as the
  // identity + the `account` for all calls, so the app shows the same address/balance as before.
  useEffect(() => {
    if (!client) {
      setAccountAddress(undefined);
      return;
    }
    let cancelled = false;
    (client as any)
      .requestAccount()
      .then((acc: { address: `0x${string}` }) => {
        if (!cancelled) setAccountAddress(acc.address);
      })
      .catch((e: unknown) => console.error('[alchemy] requestAccount failed', e));
    return () => {
      cancelled = true;
    };
  }, [client]);

  return { client, accountAddress };
}

export function useAlchemySendTransaction() {
  const { client, accountAddress } = useAlchemyClient();
  const [isLoading, setIsLoading] = useState(false);

  const sendTransaction = useMemo(() => {
    return async (callsInput: Call | Call[]) => {
      if (!client || !accountAddress) throw new Error('Alchemy client not ready');
      const calls = Array.isArray(callsInput) ? callsInput : [callsInput];
      setIsLoading(true);
      try {
        // Execute from the smart account, not the default EIP-7702 signer address.
        const { id } = await (client as any).sendCalls({ calls, account: accountAddress });
        return await client.waitForCallsStatus({ id });
      } finally {
        setIsLoading(false);
      }
    };
  }, [client, accountAddress]);

  // ERC-1271 signature produced by the smart account (EIP-191), which the node verifies via the
  // account's isValidSignature. Do NOT keccak-pre-hash here (unlike the EOA path) — the node's
  // ERC-1271 check hashes the raw message itself (hashMessage(message)).
  const signMessage = useMemo(() => {
    return async (message: string): Promise<string> => {
      if (!client || !accountAddress) throw new Error('Alchemy client not ready');
      return await (client as any).signMessage({ message, account: accountAddress });
    };
  }, [client, accountAddress]);

  return { sendTransaction, isLoading, accountAddress, signMessage };
}
