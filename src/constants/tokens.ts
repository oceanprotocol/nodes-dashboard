import { BASE_CHAIN_ID, CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';

/** Native ETH — not an ERC20, so it has no contract address. */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface TokenInfo {
  address: string;
  decimals: number;
  isNative?: boolean;
}

export const tokenAddressesByChainId = {
  [BASE_CHAIN_ID]: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  },
  [ETH_SEPOLIA_CHAIN_ID]: {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  },
};

/** The payment token on the active chain: compute fees, escrow and subsidies are all in USDC. */
export const USDC: TokenInfo & { symbol: string } = { ...tokenAddressesByChainId[CHAIN_ID].USDC, symbol: 'USDC' };

export const isUsdc = (tokenAddress: string | null | undefined): boolean =>
  tokenAddress?.toLowerCase() === USDC.address.toLowerCase();

const ETH: TokenInfo = { address: NATIVE_TOKEN_ADDRESS, decimals: 18, isNative: true };

/** Tokens shown in balance/transfer UIs, in display order. */
export const DISPLAY_TOKENS: Record<string, TokenInfo> = {
  [USDC.symbol]: USDC,
  ETH,
};
