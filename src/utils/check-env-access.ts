import { CHAIN_ID } from '@/constants/chains';
import { EnvironmentAccess } from '@/types/environments';
import { checkAddressOnAccessList } from '@/utils/access-list';
import { ethers } from 'ethers';

export async function checkEnvAccess(
  access: EnvironmentAccess | undefined,
  walletAddress: string | undefined,
  provider: ethers.ContractRunner | null
): Promise<boolean | null> {
  if (!walletAddress) return null;
  if (!access) return true;

  const hasAddressRestriction = Array.isArray(access.addresses) && access.addresses.length !== 0;
  const hasListRestriction = Array.isArray(access.accessLists) && access.accessLists.length !== 0;

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
    for (const accessListMap of access.accessLists) {
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
 * this chain), readable without a wallet. `accessLists` arrives both as an array of per-chain maps and
 * as a single per-chain map, so both shapes count.
 */
export function hasAccessRestriction(access: EnvironmentAccess | undefined): boolean {
  if (!access) {
    return false;
  }
  if (Array.isArray(access.addresses) && access.addresses.length > 0) {
    return true;
  }
  const lists: unknown = access.accessLists;
  const maps = Array.isArray(lists) ? lists : lists && typeof lists === 'object' ? [lists] : [];
  return maps.some((map) => {
    const contracts = (map as Record<string, string[] | undefined>)[String(CHAIN_ID)];
    return Array.isArray(contracts) && contracts.length > 0;
  });
}
