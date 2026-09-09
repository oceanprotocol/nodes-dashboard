import LoginModal from '@/components/auth/login-modal';
import PrivyModalWallets from '@/components/auth/privy-modal-wallets';
import { CHAIN_ID } from '@/constants/chains';
import { getRpc } from '@/lib/constants';
import { getEmbeddedWallet } from '@/lib/embedded-wallet';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage } from '@/lib/sign-message';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { readAuth, useInjectedWallet, writeAuth, type StoredAuth } from '@/lib/use-injected-wallet';
import { CircularProgress } from '@mui/material';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import posthog from 'posthog-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

const FullScreenSpinner = () => (
  <div
    style={{
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
    }}
  >
    <CircularProgress />
  </div>
);

// MetaMask returns nonce=null or nonce="undefined" for pending txs in eth_getTransactionByHash,
// which ethers v6 fails to parse as BigInt. Patch it in send() before ethers processes the response.
class MetaMaskBrowserProvider extends ethers.BrowserProvider {
  async send(method: string, params: Array<any>): Promise<any> {
    const result = await super.send(method, params);
    if (method === 'eth_getTransactionByHash' && (result?.nonce == null || result?.nonce === 'undefined')) {
      return null;
    }
    return result;
  }
}

export type SignMessageFn = (message: string) => Promise<string>;

export type OceanUser = { type: 'sca'; address: string } | { type: 'eoa'; address?: string } | null;

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
  };
  /** True while a Privy session exists — only used by the UI to show a settling spinner. */
  authenticated: boolean;
  isConnecting: boolean;
  isSendingTransaction: boolean;
  login: () => void;
  logout: () => Promise<void>;
  ocean: OceanProvider | null;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  sendTransaction: (params: {
    target: string;
    data: string;
    onSuccess?: (result: any) => void;
    onError?: (error: any) => void;
  }) => void;
  signMessage: SignMessageFn;
  user: OceanUser;
};

const OceanAccountContext = createContext<OceanAccountContextType | undefined>(undefined);

const SCAHandler = ({ children, onDisconnect }: { children: ReactNode; onDisconnect: () => void }) => {
  const { login, logout: privyLogout } = usePrivy();

  // Records an explicit disconnect: with no key at all the next load counts as a first visit
  // and silently adopts whatever browser wallet is unlocked.
  const logout = useCallback(async () => {
    await privyLogout();
    writeAuth('disconnected');
    onDisconnect();
  }, [onDisconnect, privyLogout]);
  // address is the Alchemy smart contract account (where the user's funds are), resolved from the
  // embedded-wallet signer — not the signer's own EOA address.
  const {
    sendTransaction,
    isLoading: isSendingTransaction,
    accountAddress: address,
    signMessage: signWithSmartAccount,
  } = useAlchemySendTransaction();

  useEffect(() => {
    if (!address) return;
    posthog.identify(address);
    posthog.capture('login', { address, type: 'sca' });
  }, [address]);

  const provider = useMemo(() => new ethers.JsonRpcProvider(getRpc()), []);

  const ocean = useMemo(() => new OceanProvider(CHAIN_ID, provider), [provider]);

  // Sign as the smart account (ERC-1271), since the node identifies the user by the smart-account
  // address. The Alchemy client produces a signature the account's isValidSignature accepts.
  const signMessageWrapper = useCallback(
    async (message: string): Promise<string> => {
      return await signWithSmartAccount(message);
    },
    [signWithSmartAccount]
  );

  const sendTransactionWrapper = useCallback(
    async ({
      target,
      data,
      onSuccess,
      onError,
    }: {
      target: string;
      data: string;
      onSuccess?: (result: any) => void;
      onError?: (error: any) => void;
    }) => {
      try {
        const result = await sendTransaction({ to: target as `0x${string}`, data: data as `0x${string}` });
        onSuccess?.({ ...result, hash: result?.receipts?.[0]?.transactionHash });
      } catch (error) {
        onError?.(error);
      }
    },
    [sendTransaction]
  );

  // Wait for the smart account address to resolve before rendering as connected, so we never
  // briefly expose the wrong address (or an unconnected state that retriggers the login modal).
  if (!address) {
    return <FullScreenSpinner />;
  }

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected: true },
        authenticated: true,
        isConnecting: false,
        isSendingTransaction,
        // A SCA user is always already connected, so the chooser is never needed here.
        login,
        logout,
        ocean,
        provider,
        sendTransaction: sendTransactionWrapper,
        signMessage: signMessageWrapper,
        user: { type: 'sca', address },
      }}
    >
      {children}
    </OceanAccountContext.Provider>
  );
};

const EOAHandler = ({
  authenticated,
  canAutoAdopt,
  children,
  onAuthChange,
  onPrivyLogout,
  privyUnavailable,
}: {
  authenticated: boolean;
  canAutoAdopt: boolean;
  children: ReactNode;
  onAuthChange: (auth: StoredAuth | undefined) => void;
  onPrivyLogout: () => Promise<void>;
  privyUnavailable: boolean;
}) => {
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [isFallbackLoginOpen, setIsFallbackLoginOpen] = useState(false);
  const [loginRequested, setLoginRequested] = useState(false);
  const { address, chainError, connect, disconnect, eip1193, error, isConnecting, wallets } = useInjectedWallet({
    canAutoAdopt,
  });
  const { login: privyLogin, logout: privyLogout, ready: privyReady, user: privyUser } = usePrivy();

  // A migrating user is `authenticated` with no embedded wallet until MigrationProvider
  // imports it (see shouldCreateWallet in alchemy-provider.tsx) — legitimate, not stale.
  const isMigrating = authenticated && privyUser?.customMetadata?.['alchemy_org_id'] !== undefined;

  // Privy's modal is the login UI, with the wallet list portaled into it. Queue the request
  // rather than drop it: `!ready` is true for the first moments of every healthy load.
  const login = useCallback(() => setLoginRequested(true), []);

  useEffect(() => {
    if (!loginRequested) return;
    // Fall back to our wallet-only modal only once Privy has actually failed to come up.
    if (privyUnavailable) {
      setLoginRequested(false);
      setIsFallbackLoginOpen(true);
      return;
    }
    if (!privyReady) return; // still starting — keep the request pending

    // Privy's login() no-ops on a stale session, and awaiting logout is not enough: it
    // resolves a render before `authenticated` actually flips, so calling login() in the same
    // tick silently does nothing and the user has to click twice. Keep the request pending
    // instead and let this effect re-run on the flip. Never log out a migrating user —
    // clearing their session aborts the migration.
    if (authenticated && !isMigrating) {
      privyLogout().catch(() => setLoginRequested(false));
      return;
    }

    setLoginRequested(false);
    // Drop the remembered wallet so the native path isn't a dead end, but record an explicit
    // disconnect rather than clearing: an empty record reads as "don't know yet", which
    // re-enables the silent adopt and would connect the unlocked wallet behind Privy's modal.
    writeAuth('disconnected');
    onAuthChange('disconnected');
    privyLogin();
  }, [authenticated, isMigrating, loginRequested, onAuthChange, privyLogin, privyLogout, privyReady, privyUnavailable]);

  // Mirror what the hook persisted, or the branch above keeps answering with page-load state.
  const handleConnect = useCallback(
    async (rdns: string) => {
      const connected = await connect(rdns);
      if (connected) onAuthChange({ rdns });
      return connected;
    },
    [connect, onAuthChange]
  );

  // Log out means every session: a lingering Privy one would satisfy the SCA branch on the
  // next render and sign the user back in under a different address.
  const handleDisconnect = useCallback(async () => {
    await disconnect();
    if (authenticated) {
      await onPrivyLogout();
    }
    onAuthChange('disconnected');
  }, [authenticated, disconnect, onAuthChange, onPrivyLogout]);

  const signerProvider = useMemo(() => (eip1193 ? new MetaMaskBrowserProvider(eip1193) : null), [eip1193]);

  // Chain reads that need no account (node balances, access-list checks) must keep working
  // while disconnected.
  const readProvider = useMemo(() => new ethers.JsonRpcProvider(getRpc()), []);
  const provider = signerProvider ?? readProvider;

  useEffect(() => {
    if (address) {
      posthog.identify(address);
      posthog.capture('login', { address, type: 'eoa' });
    }
  }, [address]);

  // Happens with both modals closed, so without a toast the header just flips back to
  // "Log in" unexplained. Connect errors are excluded — the wallet list shows those inline.
  useEffect(() => {
    if (chainError) toast.error(chainError);
  }, [chainError]);

  const ocean = useMemo(() => new OceanProvider(CHAIN_ID, provider), [provider]);

  // Guarded on signerProvider: `provider` may be the read-only RPC one.
  const signMessageWrapper = useCallback(
    async (message: string) => {
      if (!address || !signerProvider) {
        throw new Error('No signer available');
      }
      const signer = await signerProvider.getSigner();
      return await signMessage(message, signer);
    },
    [address, signerProvider]
  );

  const sendTransactionWrapper = useCallback(
    async ({
      target,
      data,
      onSuccess,
      onError,
    }: {
      target: string;
      data: string;
      onSuccess?: (result: any) => void;
      onError?: (error: any) => void;
    }) => {
      if (!signerProvider) {
        onError?.(new Error('No wallet connected'));
        return;
      }
      try {
        setIsSendingTransaction(true);
        const signer = await signerProvider.getSigner();
        const tx = await signer.sendTransaction({ to: target, data });
        const receipt = await tx.wait();
        onSuccess?.(receipt);
      } catch (error) {
        console.error('EOA Transaction error:', error);
        onError?.(error);
      } finally {
        setIsSendingTransaction(false);
      }
    },
    [signerProvider]
  );

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected: !!address },
        authenticated,
        isConnecting,
        isSendingTransaction,
        login,
        logout: handleDisconnect,
        ocean,
        provider,
        sendTransaction: sendTransactionWrapper,
        signMessage: signMessageWrapper,
        user: address ? { type: 'eoa', address } : null,
      }}
    >
      {children}
      <PrivyModalWallets error={error} isConnecting={isConnecting} onConnect={handleConnect} wallets={wallets} />
      <LoginModal
        error={error}
        isConnecting={isConnecting}
        isOpen={isFallbackLoginOpen}
        onClose={() => setIsFallbackLoginOpen(false)}
        onConnect={handleConnect}
        wallets={wallets}
      />
    </OceanAccountContext.Provider>
  );
};

/** How long we wait on Privy before giving up and letting the native path through. */
const PRIVY_READY_TIMEOUT_MS = 4000;

export const OceanAccountProvider = ({ children }: { children: ReactNode }) => {
  // null = localStorage not read yet; same spinner on server and first client paint.
  const [auth, setAuth] = useState<StoredAuth | undefined | null>(null);
  const [privyTimedOut, setPrivyTimedOut] = useState(false);

  const { ready, authenticated, logout: privyLogout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const embeddedWallet = getEmbeddedWallet(wallets);

  useEffect(() => setAuth(readAuth()), []);

  // Armed for every visitor: privyTimedOut is what tells the rest of the tree that Privy
  // failed to start. Without it a visitor behind an ad blocker has no way in at all.
  const stalled = !ready || (authenticated && !walletsReady);
  useEffect(() => {
    if (!stalled) return;
    const timer = setTimeout(() => setPrivyTimedOut(true), PRIVY_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stalled]);

  const privyUnavailable = privyTimedOut && !ready;
  const privySettled = ready || privyTimedOut;
  const rememberedWallet = auth && auth !== 'disconnected';

  // A remembered wallet never waits on Privy — the whole point of this provider. Logged-out
  // has nothing to restore. Only the unknown case waits, so an existing smart-account user
  // isn't mounted as logged-out and then remounted.
  const waitForPrivy = auth === undefined && stalled && !privyTimedOut;

  // Adopt silently when we know which wallet, or when Privy settled with no session.
  const canAutoAdopt = !!rememberedWallet || (auth === undefined && privySettled && !authenticated);

  if (auth === null || waitForPrivy) {
    return <FullScreenSpinner />;
  }

  // A remembered wallet outranks an inherited Privy session, which would otherwise reclaim
  // the account the user just connected.
  if (!rememberedWallet && authenticated && embeddedWallet) {
    return <SCAHandler onDisconnect={() => setAuth('disconnected')}>{children}</SCAHandler>;
  }

  return (
    <EOAHandler
      authenticated={authenticated}
      canAutoAdopt={canAutoAdopt}
      onAuthChange={setAuth}
      onPrivyLogout={privyLogout}
      privyUnavailable={privyUnavailable}
    >
      {children}
    </EOAHandler>
  );
};

export function useOceanAccount() {
  const context = useContext(OceanAccountContext);
  if (context === undefined) {
    throw new Error('useOceanAccount must be used within a OceanAccountProvider');
  }
  return context;
}
