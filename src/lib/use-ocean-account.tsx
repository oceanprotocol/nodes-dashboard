import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage } from '@/lib/sign-message';
import { useSignerStatus, useSignMessage, useSmartAccountClient, useUser, UseUserResult } from '@account-kit/react';
import { CircularProgress } from '@mui/material';
import { ethers } from 'ethers';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
    isWallet: boolean;
  };
  client?: ReturnType<typeof useSmartAccountClient>['client'];
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  ocean: OceanProvider | null;
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

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected, isWallet: user?.type === 'eoa' },
        client,
        ocean,
        provider,
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

  return (
    <OceanAccountContext.Provider
      value={{
        account: { address, isConnected, isWallet: user?.type === 'eoa' },
        ocean,
        provider,
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
  const { isInitializing, isAuthenticating, isConnected } = useSignerStatus();
  if (user?.type === 'sca') {
    if (isInitializing || isAuthenticating || !isConnected) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
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
