import { CHAIN_ID } from '@/constants/chains';
import { getRpc } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage } from '@/lib/sign-message';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
import { getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import { CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import posthog from 'posthog-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

// Minimal user shape kept for backwards-compat with SCA/EOA guards in transaction hooks
export type OceanUser = { type: 'sca'; address: string } | { type: 'eoa'; address?: string } | null;

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
  };
  isSendingTransaction: boolean;
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

const SCAHandler = ({ children }: { children: ReactNode }) => {
  const { user: privyUser, signMessage: privySignMessage } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction: alchemySendTransaction, isLoading: isSendingUserOperation } = useAlchemySendTransaction();

  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const address = embeddedWallet?.address ?? (privyUser as any)?.wallet?.address;
  const isConnected = !!address;

  useEffect(() => {
    if (address) {
      posthog.identify(address);
      posthog.capture('login', { address, type: 'sca' });
    }
  }, [address]);

  const provider = useMemo(() => {
    if (!isConnected) return null;
    return new ethers.JsonRpcProvider(getRpc());
  }, [isConnected]);

  const ocean = useMemo(() => {
    if (!provider) return null;
    return new OceanProvider(CHAIN_ID, provider);
  }, [provider]);

  const signMessageWrapper = useCallback(
    async (message: string) => {
      const { signature } = await privySignMessage({ message });
      return signature;
    },
    [privySignMessage]
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
        const result = await alchemySendTransaction({
          to: target as `0x${string}`,
          data: data as `0x${string}`,
        });
        // Normalize txnHash → hash so callers expecting ethers-style receipt work uniformly
        onSuccess?.({ ...result, hash: result.txnHash });
      } catch (error) {
        onError?.(error);
      }
    },
    [alchemySendTransaction]
  );

  const user: OceanUser = address ? { type: 'sca', address } : null;

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected },
        isSendingTransaction: isSendingUserOperation,
        ocean,
        provider,
        sendTransaction: sendTransactionWrapper,
        signMessage: signMessageWrapper,
        user,
      }}
    >
      {children}
    </OceanAccountContext.Provider>
  );
};

const EOAHandler = ({ children }: { children: ReactNode }) => {
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);

  // EOA address comes from window.ethereum — derive it from the provider
  const provider = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new MetaMaskBrowserProvider((window as any).ethereum);
    }
    return null;
  }, []);

  const [address, setAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!provider) return;
    provider.getSigner().then((s) => s.getAddress().then(setAddress)).catch(() => {});
  }, [provider]);

  const isConnected = !!address;

  useEffect(() => {
    if (address) {
      posthog.identify(address);
      posthog.capture('login', { address, type: 'eoa' });
    }
  }, [address]);

  const ocean = useMemo(() => {
    if (!provider) return null;
    return new OceanProvider(CHAIN_ID, provider);
  }, [provider]);

  const signMessageWrapper = useCallback(
    async (message: string) => {
      if (!address || !provider) {
        throw new Error('No signer available');
      }
      const signer = await provider.getSigner();
      return await signMessage(message, signer);
    },
    [address, provider]
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
      if (!provider) {
        onError?.(new Error('No provider available'));
        return;
      }
      try {
        setIsSendingTransaction(true);
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({
          to: target,
          data,
        });
        const recipe = await tx.wait();
        onSuccess?.(recipe);
      } catch (error) {
        console.error('EOA Transaction error:', error);
        onError?.(error);
      } finally {
        setIsSendingTransaction(false);
      }
    },
    [provider]
  );

  const user: OceanUser = { type: 'eoa', address };

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected },
        isSendingTransaction,
        ocean,
        provider,
        sendTransaction: sendTransactionWrapper,
        signMessage: signMessageWrapper,
        user,
      }}
    >
      {children}
    </OceanAccountContext.Provider>
  );
};

export const OceanAccountProvider = ({ children }: { children: ReactNode }) => {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  // Show spinner while Privy is loading after authentication
  if (authenticated && (!ready || !walletsReady)) {
    return (
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
  }

  if (authenticated && embeddedWallet) {
    return <SCAHandler>{children}</SCAHandler>;
  }
  return <EOAHandler>{children}</EOAHandler>;
};

export function useOceanAccount() {
  const context = useContext(OceanAccountContext);
  if (context === undefined) {
    throw new Error('useOceanAccount must be used within a OceanAccountProvider');
  }
  return context;
}
