export const BASE_CHAIN_ID = 8453;
export const ETH_SEPOLIA_CHAIN_ID = 11155111;

export const CHAIN_ID = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? BASE_CHAIN_ID : ETH_SEPOLIA_CHAIN_ID;

export const CHAIN_LABELS: Record<number, string> = {
  [BASE_CHAIN_ID]: 'Base',
  [ETH_SEPOLIA_CHAIN_ID]: 'Sepolia',
};

export const getExplorerUrl = () => {
  if (CHAIN_ID === BASE_CHAIN_ID) {
    return 'https://basescan.org';
  }
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) {
    return 'https://sepolia.etherscan.io';
  }
  return 'https://etherscan.io';
};

export const getExplorerAddressUrl = (address: string) => `${getExplorerUrl()}/address/${address}`;
