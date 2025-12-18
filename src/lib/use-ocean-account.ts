import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { useSmartAccountClient, useUser } from '@account-kit/react';
import { ethers } from 'ethers';
import { useMemo } from 'react';

export function useOceanAccount() {
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount' });

  const account = useMemo(() => {
    if (!client) {
      return {
        address: undefined,
        isConnected: false,
        status: 'disconnected' as const,
      };
    }

    return {
      address: client.getAddress(),
      isConnected: true,
      status: 'connected' as const,
    };
  }, [client]);

  const provider = useMemo(() => {
    if (!client) return null;
    return new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });
  }, [client]);

  const ocean = useMemo(() => {
    if (!provider || !client) return null;

    return new OceanProvider(CHAIN_ID, provider);
  }, [provider, client]);

  return {
    account,
    client,
    provider,
    ocean,
    user,
  };
}
