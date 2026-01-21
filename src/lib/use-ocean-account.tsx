import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { signMessage as signMessageWithEthers } from '@/lib/sign-message';
import { useSignerStatus, useSignMessage, useSmartAccountClient, useUser, UseUserResult } from '@account-kit/react';
import { CircularProgress } from '@mui/material';
import { ethers, JsonRpcSigner } from 'ethers';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
  };
  client?: ReturnType<typeof useSmartAccountClient>['client'];
  provider: ethers.JsonRpcProvider | null;
  ocean: OceanProvider | null;
  signMessage: (message: string) => Promise<string>;
  user: UseUserResult;
};

const OceanAccountContext = createContext<OceanAccountContextType | undefined>(undefined);

function useOceanProvider({ isConnected, user }: { isConnected: boolean; user: OceanAccountContextType['user'] }) {
  const provider = useMemo(() => {
    if (!isConnected) return null;
    return new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  }, [isConnected]);

  const ocean = useMemo(() => {
    if (!provider) return null;
    return new OceanProvider(CHAIN_ID, provider);
  }, [provider]);

  return {
    provider,
    ocean,
    user,
  };
}

const SCAHandler = ({ children }: { children: ReactNode }) => {
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const { signMessageAsync } = useSignMessage({ client });

  const address = client?.account?.address ?? user?.address;
  const isConnected = !!client;
  const { ocean, provider } = useOceanProvider({ isConnected, user });

  const signMessage = useCallback(
    async (message: string) => {
      return await signMessageAsync({ message });
    },
    [signMessageAsync]
  );

  return (
    <OceanAccountContext.Provider
      value={{ account: { address, isConnected }, client, ocean, provider, signMessage, user }}
    >
      {children}
    </OceanAccountContext.Provider>
  );
};

const EOAHandler = ({ children }: { children: ReactNode }) => {
  const user = useUser();

  const address = user?.address;
  const isConnected = !!user;
  const { ocean, provider } = useOceanProvider({ isConnected, user });

  const signMessage = useCallback(
    async (message: string) => {
      if (!address || !provider) {
        throw new Error('No signer available');
      }
      const signer = new JsonRpcSigner(provider, address);
      return await signMessageWithEthers(message, signer);
    },
    [address, provider]
  );

  return (
    <OceanAccountContext.Provider value={{ account: { address, isConnected }, ocean, provider, signMessage, user }}>
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
