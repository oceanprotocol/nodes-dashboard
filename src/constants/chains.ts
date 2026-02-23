export const BASE_CHAIN_ID = 8453;
export const ETH_SEPOLIA_CHAIN_ID = 11155111;

export const CHAIN_ID = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? BASE_CHAIN_ID : ETH_SEPOLIA_CHAIN_ID;
