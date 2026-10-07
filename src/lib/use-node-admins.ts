import { CHAIN_ID } from '@/constants/chains';
import { useP2P } from '@/contexts/P2PContext';
import { directNodeCommandJson } from '@/lib/direct-node-command';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types/nodes';
import {
  getAdminAccessListContracts,
  isAddressInAdmins,
  isWalletOnAdminAccessLists,
  NodeAdmins,
  uniqueAddresses,
} from '@/utils/node-admin';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type NodeStatusAdmins = {
  allowedAdmins?: NodeAdmins;
};

type NodeAdminsState = {
  addresses: string[];
  isAdmin: boolean;
  loading: boolean;
};

const STALE_TIME = 5 * 60 * 1000;

export function useNodeAdmins(node: Node | null | undefined): NodeAdminsState {
  const { account } = useOceanAccount();
  const { getAccessListAddresses } = useAccessList();
  const { isReady: isP2PReady, sendCommand } = useP2P();

  const wallet = account.address?.toLowerCase();
  const nodeId = node?.id ?? node?.nodeId;
  const currentAddrs = node?.currentAddrs;

  // TODO: read admin access lists from `node` and drop this status command once the backend exposes them.
  const statusQuery = useQuery({
    queryKey: ['node-admins', nodeId],
    enabled: !!nodeId,
    staleTime: STALE_TIME,
    retry: false,
    queryFn: async (): Promise<NodeAdmins | null> => {
      if (!nodeId) {
        return null;
      }
      if (isP2PReady) {
        try {
          const status: NodeStatusAdmins = await sendCommand(currentAddrs?.length ? currentAddrs : [nodeId], {
            command: 'status',
          });
          return status?.allowedAdmins ?? null;
        } catch (error) {
          console.error('Failed to fetch node status over P2P:', error);
        }
      }
      const status = await directNodeCommandJson<NodeStatusAdmins>({
        command: 'status',
        label: 'Node status',
        multiaddrs: currentAddrs,
        peerId: nodeId,
      });
      return status?.allowedAdmins ?? null;
    },
  });

  const contracts = useMemo(() => getAdminAccessListContracts(statusQuery.data?.accessLists), [statusQuery.data]);

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
    () =>
      uniqueAddresses([
        ...(node?.allowedAdmins ?? []),
        ...(statusQuery.data?.addresses ?? []),
        ...(membersQuery.data ?? []),
      ]),
    [membersQuery.data, node?.allowedAdmins, statusQuery.data]
  );

  const isListedAdmin = isAddressInAdmins(addresses, wallet);

  const onChainQuery = useQuery({
    queryKey: ['node-admin-on-chain', CHAIN_ID, contracts, wallet],
    enabled: !!wallet && !isListedAdmin && contracts.length > 0 && !membersQuery.isFetching,
    staleTime: STALE_TIME,
    retry: false,
    queryFn: () => isWalletOnAdminAccessLists(statusQuery.data?.accessLists, wallet),
  });

  return {
    addresses,
    isAdmin: isListedAdmin || !!onChainQuery.data,
    loading: statusQuery.isFetching || membersQuery.isFetching || onChainQuery.isFetching,
  };
}
