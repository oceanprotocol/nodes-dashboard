import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { useAccount, useSmartAccountClient, useUser, UseUserResult } from '@account-kit/react';
import { ethers } from 'ethers';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type OceanAccountContextType = {
  account: {
    address: string | undefined;
    isConnected: boolean;
  };
  client?: ReturnType<typeof useSmartAccountClient>['client'];
  provider: ethers.JsonRpcProvider | null;
  ocean: OceanProvider | null;
  user: UseUserResult;
};

const OceanAccountContext = createContext<OceanAccountContextType | undefined>(undefined);

function useAccountData({
  address,
  client,
  isConnected,
  user,
}: {
  address: string | undefined;
  client?: OceanAccountContextType['client'];
  isConnected: boolean;
  user: OceanAccountContextType['user'];
}): OceanAccountContextType {
  const provider = useMemo(() => {
    if (!isConnected) return null;
    return new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  }, [isConnected]);

  const ocean = useMemo(() => {
    if (!provider) return null;
    return new OceanProvider(CHAIN_ID, provider);
  }, [provider]);

  return {
    account: { address, isConnected },
    client,
    provider,
    ocean,
    user,
  };
}

const SCAHandler = ({ children }: { children: ReactNode }) => {
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount' });
  const address = client?.account?.address ?? user?.address;
  const isConnected = !!client;
  const accountData = useAccountData({ address, client, isConnected, user });
  return <OceanAccountContext.Provider value={accountData}>{children}</OceanAccountContext.Provider>;
};

const EOAHandler = ({ children }: { children: ReactNode }) => {
  const user = useUser();
  const account = useAccount({ type: 'LightAccount' });
  const address = user?.address ?? account?.address;
  const isConnected = !!user || !!account?.address;
  const accountData = useAccountData({ address, isConnected, user });
  return <OceanAccountContext.Provider value={accountData}>{children}</OceanAccountContext.Provider>;
};

export const OceanAccountProvider = ({ children }: { children: ReactNode }) => {
  const user = useUser();
  console.log(user?.type);
  if (user?.type === 'sca') {
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
