import { CHAIN_ID } from '@/constants/chains';
import type { NodeUri } from '@/contexts/P2PContext';
import { getRpc } from '@/lib/constants';
import { directNodeCommandJson } from '@/lib/direct-node-command';
import { checkAddressOnAccessList } from '@/utils/access-list';
import { ethers } from 'ethers';

export type NodeAdmins = {
  addresses?: string[] | null;
  accessLists?: Record<string, string[] | undefined> | null;
};

type NodeStatusAdmins = {
  allowedAdmins?: NodeAdmins;
};

export async function fetchNodeAdmins({
  currentAddrs,
  isP2PReady,
  nodeId,
  sendCommand,
}: {
  currentAddrs?: string[];
  isP2PReady: boolean;
  nodeId: string;
  sendCommand: (nodeUri: NodeUri, command: any) => Promise<any>;
}): Promise<NodeAdmins | null> {
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
}

export function isAddressInAdmins(addresses: string[] | null | undefined, wallet: string | null | undefined): boolean {
  if (!wallet || !addresses?.length) {
    return false;
  }
  const lower = wallet.toLowerCase();
  return addresses.some((address) => address.toLowerCase() === lower);
}

export function uniqueAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const lower = address.toLowerCase();
    if (seen.has(lower)) {
      return false;
    }
    seen.add(lower);
    return true;
  });
}

export function getAdminAccessListContracts(accessLists: NodeAdmins['accessLists']): string[] {
  if (!accessLists || typeof accessLists !== 'object' || Array.isArray(accessLists)) {
    return [];
  }
  return uniqueAddresses((accessLists[String(CHAIN_ID)] ?? []).filter((contract) => ethers.isAddress(contract)));
}

export async function isWalletOnAdminAccessLists(
  accessLists: NodeAdmins['accessLists'],
  wallet: string | null | undefined
): Promise<boolean> {
  if (!wallet) {
    return false;
  }
  const contracts = getAdminAccessListContracts(accessLists);
  if (contracts.length === 0) {
    return false;
  }
  const provider = new ethers.JsonRpcProvider(getRpc());
  const results = await Promise.all(contracts.map((contract) => checkAddressOnAccessList(contract, wallet, provider)));
  return results.some(Boolean);
}

export async function isNodeAdmin(
  admins: NodeAdmins | null | undefined,
  wallet: string | null | undefined
): Promise<boolean> {
  if (!admins || !wallet) {
    return false;
  }
  if (isAddressInAdmins(admins.addresses, wallet)) {
    return true;
  }
  return isWalletOnAdminAccessLists(admins.accessLists, wallet);
}
