import { CHAIN_ID } from '@/constants/chains';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types/nodes';
import {
  getAdminAccessListContracts,
  isAddressInAdmins,
  isWalletOnAdminAccessLists,
  toNodeAdminAccessLists,
  uniqueAddresses,
} from '@/utils/node-admin';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type NodeAdminsState = {
  addresses: string[];
  isAdmin: boolean;
  loading: boolean;
};

const STALE_TIME = 5 * 60 * 1000;

export function useNodeAdmins(node: Node | null | undefined): NodeAdminsState {
  const { account } = useOceanAccount();
  const { getAccessListAddresses } = useAccessList();

  const wallet = account.address?.toLowerCase();

  const accessLists = useMemo(() => toNodeAdminAccessLists(node?.adminAccessLists), [node?.adminAccessLists]);
  const contracts = useMemo(() => getAdminAccessListContracts(accessLists), [accessLists]);

  const membersQuery = useQuery({
    queryKey: ['node-admin-members', CHAIN_ID, contracts],
    enabled: contracts.length > 0,
    staleTime: STALE_TIME,
    retry: false,
    queryFn: async () => {
      const members = await Promise.all(
        contracts.map((contract) =>
          getAccessListAddresses(contract).catch((error) => {
            console.error(`Failed to fetch members of access list ${contract}:`, error);
            return [] as string[];
          })
        )
      );
      return members.flat();
    },
  });

  const addresses = useMemo(
    () => uniqueAddresses([...(node?.allowedAdmins ?? []), ...(membersQuery.data ?? [])]),
    [membersQuery.data, node?.allowedAdmins]
  );

  const isListedAdmin = isAddressInAdmins(addresses, wallet);

  const onChainQuery = useQuery({
    queryKey: ['node-admin-on-chain', CHAIN_ID, contracts, wallet],
    enabled: !!wallet && !isListedAdmin && contracts.length > 0 && !membersQuery.isFetching,
    staleTime: STALE_TIME,
    retry: false,
    queryFn: () => isWalletOnAdminAccessLists(accessLists, wallet),
  });

  return {
    addresses,
    isAdmin: isListedAdmin || !!onChainQuery.data,
    loading: membersQuery.isFetching || onChainQuery.isFetching,
  };
}
