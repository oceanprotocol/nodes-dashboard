import { BASE_CHAIN_ID, CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';

export const tokenAddressesByChainId = {
  [BASE_CHAIN_ID]: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    COMPY: { address: '0x298f163244e0c8cc9316D6E97162e5792ac5d410', decimals: 6 },
  },
  [ETH_SEPOLIA_CHAIN_ID]: {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    COMPY: { address: '0x973e69303259B0c2543a38665122b773D28405fB', decimals: 6 },
  },
};

export const getSupportedTokens = () => {
  return tokenAddressesByChainId[CHAIN_ID];
};
