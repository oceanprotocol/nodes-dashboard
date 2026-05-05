import { CHAIN_ID } from '@/constants/chains';
import { getRpc } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage } from '@/lib/sign-message';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import posthog from 'posthog-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getEmbeddedConnectedWallet, usePrivy, useWallets } from '@privy-io/react-auth';

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
  isSendingTransaction: boolean;
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

const SCAHandler = ({ children, address }: { children: ReactNode; address: string }) => {
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction, isLoading: isSendingTransaction } = useAlchemySendTransaction();

  useEffect(() => {
    posthog.identify(address);
    posthog.capture('login', { address, type: 'sca' });
  }, [address]);

  const provider = useMemo(() => new ethers.JsonRpcProvider(getRpc()), []);

  const ocean = useMemo(() => new OceanProvider(CHAIN_ID, provider), [provider]);

  const signMessageWrapper = useCallback(
    async (message: string): Promise<string> => {
      const embeddedWallet = getEmbeddedConnectedWallet(wallets);
      if (!embeddedWallet) throw new Error('No embedded wallet available');
      const ethProvider = await embeddedWallet.getEthereumProvider();
      return await ethProvider.request({
        method: 'personal_sign',
        params: [message, embeddedWallet.address],
      });
    },
    [wallets]
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

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected: true },
        isSendingTransaction,
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

const EOAHandler = ({ children }: { children: ReactNode }) => {
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [address, setAddress] = useState<string | undefined>();

  const provider = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new MetaMaskBrowserProvider((window as any).ethereum);
    }
    return null;
  }, []);

  useEffect(() => {
    if (!provider) return;
    const ethereum = (window as any).ethereum;

    provider
      .listAccounts()
      .then((accounts) => accounts[0]?.address)
      .then((addr) => setAddress(addr))
      .catch(() => {});

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] ?? undefined);
    };

    ethereum?.on('accountsChanged', handleAccountsChanged);
    return () => {
      ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [provider]);

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

  const logout = useCallback(async () => {
    try {
      await (window as any).ethereum?.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch {} // not supported by all wallets
    setAddress(undefined);
  }, []);

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
    [provider]
  );

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected: !!address },
        isSendingTransaction,
        logout,
        ocean,
        provider,
        sendTransaction: sendTransactionWrapper,
        signMessage: signMessageWrapper,
        user: address ? { type: 'eoa', address } : null,
      }}
    >
      {children}
    </OceanAccountContext.Provider>
  );
};

export const OceanAccountProvider = ({ children }: { children: ReactNode }) => {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);

  if (!ready) {
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
    return <SCAHandler address={embeddedWallet.address}>{children}</SCAHandler>;
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
