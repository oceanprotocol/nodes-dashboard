import { CHAIN_ID } from '@/constants/chains';
import { loadPayerEscrowEvents } from '@/lib/escrow-events';
import { fetchNodesByWallets } from '@/lib/use-escrow-data';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const EVENTS_STALE_TIME = 30_000;
const NODES_STALE_TIME = 5 * 60_000;

export const usePayerEscrowEvents = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { account } = useOceanAccount();

  return useQuery({
    queryKey: ['escrow-events', CHAIN_ID, account.address],
    enabled: enabled && !!account.address,
    staleTime: EVENTS_STALE_TIME,
    queryFn: () => loadPayerEscrowEvents(account.address!),
  });
};

/** Keyed by lowercased wallet address; wallets that are not a known node are absent. */
export const useNodesByWallets = (wallets: string[]) => {
  const uniqueWallets = useMemo(
    () => [...new Set(wallets.filter(Boolean).map((wallet) => wallet.toLowerCase()))].sort(),
    [wallets]
  );

  return useQuery({
    queryKey: ['nodes-by-wallets', uniqueWallets],
    enabled: uniqueWallets.length > 0,
    staleTime: NODES_STALE_TIME,
    queryFn: () => fetchNodesByWallets(uniqueWallets),
  });
};
