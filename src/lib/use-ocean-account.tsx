import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage } from '@/lib/sign-message';
import {
  useAccount,
  useSendUserOperation,
  useSignerStatus,
  useSignMessage,
  useSmartAccountClient,
  useUser,
  UseUserResult,
} from '@account-kit/react';
import { CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
  };
  client?: ReturnType<typeof useSmartAccountClient>['client'];
  isSendingTransaction: boolean;
  ocean: OceanProvider | null;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  sendTransaction: (params: {
    target: string;
    data: string;
    onSuccess?: (result: any) => void;
    onError?: (error: any) => void;
  }) => void;
  signMessage: (message: string) => Promise<string>;
  user: UseUserResult;
};

const OceanAccountContext = createContext<OceanAccountContextType | undefined>(undefined);

const SCAHandler = ({ children }: { children: ReactNode }) => {
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({ client });

  const address = client?.account?.address ?? user?.address;
  const isConnected = !!client;

  const provider = useMemo(() => {
    if (!isConnected) return null;
    return new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  }, [isConnected]);

  const ocean = useMemo(() => {
    if (!provider) return null;
    return new OceanProvider(CHAIN_ID, provider);
  }, [provider]);

  const signMessageWrapper = useCallback(
    async (message: string) => {
      return await signMessageAsync({ message });
    },
    [signMessageAsync]
  );

  const { sendUserOperation, isSendingUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
  });

  const sendTransactionWrapper = useCallback(
    ({
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
      sendUserOperation(
        {
          uo: {
            target: target as `0x${string}`,
            data: data as `0x${string}`,
          },
        },
        {
          onSuccess: (result: any) => {
            onSuccess?.(result);
          },
          onError: (error: any) => {
            onError?.(error);
          },
        }
      );
    },
    [sendUserOperation]
  );

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected },
        isSendingTransaction: isSendingUserOperation,
        client,
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
  const user = useUser();
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);

  const address = user?.address;
  const isConnected = !!user;

  const provider = useMemo(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
    return null;
  }, []);

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
  const user = useUser();

  const { account, isLoadingAccount } = useAccount({ type: 'LightAccount' });
  const { isInitializing, isAuthenticating, isConnected } = useSignerStatus();

  if (user?.type === 'sca') {
    if (isInitializing || isAuthenticating || !isConnected || isLoadingAccount || !account) {
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
