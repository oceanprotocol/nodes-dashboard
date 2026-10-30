import { CHAIN_ID } from '@/constants/chains';

const STORAGE_PREFIX = 'custom-subsidies';

const storageKey = (owner: string) => `${STORAGE_PREFIX}-${CHAIN_ID}-${owner.toLowerCase()}`;

export function recallCustomSubsidies(owner: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(owner)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((address): address is string => typeof address === 'string') : [];
  } catch (error) {
    console.error('Failed to read custom subsidies:', error);
    return [];
  }
}

const storeCustomSubsidies = (owner: string, addresses: string[]) => {
  try {
    localStorage.setItem(storageKey(owner), JSON.stringify(addresses));
  } catch (error) {
    console.error('Failed to store custom subsidies:', error);
  }
};

export function rememberCustomSubsidy(owner: string, address: string): void {
  const addresses = recallCustomSubsidies(owner);
  if (addresses.some((stored) => stored.toLowerCase() === address.toLowerCase())) {
    return;
  }
  storeCustomSubsidies(owner, [...addresses, address]);
}

export function forgetCustomSubsidy(owner: string, address: string): void {
  storeCustomSubsidies(
    owner,
    recallCustomSubsidies(owner).filter((stored) => stored.toLowerCase() !== address.toLowerCase())
  );
}
