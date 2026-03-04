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

  const hasAddressRestriction = access.addresses && access.addresses.length !== 0;
  const hasListRestriction = access.accessLists && access.accessLists.length !== 0;

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
