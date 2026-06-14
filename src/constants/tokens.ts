import addresses from '@oceanprotocol/contracts/addresses/address.json';
import { BASE_CHAIN_ID, CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';

export const tokenAddressesByChainId = {
  [BASE_CHAIN_ID]: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    COMPY: { address: addresses.base.COMPY, decimals: 6 },
  },
  [ETH_SEPOLIA_CHAIN_ID]: {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
    COMPY: { address: addresses.sepolia.COMPY, decimals: 6 },
  },
};

export const getSupportedTokens = () => {
  return tokenAddressesByChainId[CHAIN_ID];
};
