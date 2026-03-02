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

  if (access.addresses && access.addresses.length !== 0) {
    const lower = walletAddress.toLowerCase();

    return access.addresses.some((a) => a.toLowerCase() === lower);
  }

  if (access.accessLists && Object.keys(access.accessLists).length !== 0) {
    if (!provider) return null;

    const contractAddresses = access.accessLists[String(CHAIN_ID)];
    if (!contractAddresses || contractAddresses.length === 0) {
      return true;
    }

    for (const contractAddress of contractAddresses) {
      const hasAccess = await checkAddressOnAccessList(contractAddress, walletAddress, provider);
      if (hasAccess) return true;
    }

    return false;
  }

  return true;
}
