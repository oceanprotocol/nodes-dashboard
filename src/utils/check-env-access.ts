import { CHAIN_ID } from '@/constants/chains';
import { EnvironmentAccess } from '@/types/environments';
import { checkAddressOnAccessList } from '@/utils/access-list';
import { ethers } from 'ethers';

/**
 * An environment's access-list maps (chain id -> contracts). `accessLists` arrives both as an array of
 * per-chain maps and as a single per-chain map; both read the same here.
 */
function accessListMaps(access: EnvironmentAccess): Record<string, string[] | undefined>[] {
  const lists: unknown = access.accessLists;
  if (Array.isArray(lists)) {
    return lists;
  }
  // An empty map lists nothing, the same as an empty array.
  return lists && typeof lists === 'object' && Object.keys(lists).length > 0
    ? [lists as Record<string, string[] | undefined>]
    : [];
}

export async function checkEnvAccess(
  access: EnvironmentAccess | undefined,
  walletAddress: string | undefined,
  provider: ethers.ContractRunner | null
): Promise<boolean | null> {
  if (!walletAddress) return null;
  if (!access) return true;

  const hasAddressRestriction = Array.isArray(access.addresses) && access.addresses.length !== 0;
  const listMaps = accessListMaps(access);
  const hasListRestriction = listMaps.length !== 0;

  if (!hasAddressRestriction && !hasListRestriction) return true;

  // Grant access if wallet is in the direct address whitelist
  if (hasAddressRestriction) {
    const lower = walletAddress.toLowerCase();
    if (access.addresses.some((a) => a.toLowerCase() === lower)) return true;
  }

  // Grant access if wallet holds a token from any access list contract
  if (hasListRestriction) {
    if (!provider) return null;

    let hasApplicableList = false;
    for (const accessListMap of listMaps) {
      const contractAddresses = accessListMap[String(CHAIN_ID)];
      if (!contractAddresses || contractAddresses.length === 0) continue;
      hasApplicableList = true;
      for (const contractAddress of contractAddresses) {
        const hasAccess = await checkAddressOnAccessList(contractAddress, walletAddress, provider);
        if (hasAccess) return true;
      }
    }

    if (!hasApplicableList) return true;
  }

  return false;
}

/**
 * Whether an environment restricts who may use it (an address allowlist or an access-list contract on
 * this chain), readable without a wallet.
 */
export function hasAccessRestriction(access: EnvironmentAccess | undefined): boolean {
  if (!access) {
    return false;
  }
  if (Array.isArray(access.addresses) && access.addresses.length > 0) {
    return true;
  }
  return accessListMaps(access).some((map) => {
    const contracts = map[String(CHAIN_ID)];
    return Array.isArray(contracts) && contracts.length > 0;
  });
}
