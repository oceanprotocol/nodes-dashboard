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

/** Native ETH — not an ERC20, so it has no contract address. */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface TokenInfo {
  address: string;
  decimals: number;
  isNative?: boolean;
}

const ETH: TokenInfo = { address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true };

/**
 * Tokens shown in balance/transfer UIs, in display order.
 * Separate from `tokenAddressesByChainId`, which is the fee-token list used to filter environments.
 */
export const displayTokensByChainId: Record<number, Record<string, TokenInfo>> = {
  [BASE_CHAIN_ID]: {
    USDC: tokenAddressesByChainId[BASE_CHAIN_ID].USDC,
    COMPY: tokenAddressesByChainId[BASE_CHAIN_ID].COMPY,
    ETH,
  },
  [ETH_SEPOLIA_CHAIN_ID]: {
    USDC: tokenAddressesByChainId[ETH_SEPOLIA_CHAIN_ID].USDC,
    COMPY: tokenAddressesByChainId[ETH_SEPOLIA_CHAIN_ID].COMPY,
    ETH,
  },
};

export const getDisplayTokens = () => {
  return displayTokensByChainId[CHAIN_ID];
};
