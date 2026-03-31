import { CHAIN_ID } from '@/constants/chains';
import { tokenAddressesByChainId } from '@/constants/tokens';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

/**
 * Get the number of decimals for a known token from tokenAddressesByChainId, by its address.
 * Falls back to 6 if the token is not in tokenAddressesByChainId.
 */
const getTokenDecimals = (tokenAddress: string): number => {
  const tokens = tokenAddressesByChainId[CHAIN_ID];
  if (!tokens) return 6;
  for (const token of Object.values(tokens)) {
    if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
      return token.decimals;
    }
  }
  return 6;
};

/**
 * Round a token amount to the token's decimal precision.
 * Use this for arithmetic results to eliminate floating point noise before comparisons or displaying values.
 */
export const roundTokenAmount = (
  amount: number,
  tokenAddress: string,
  direction: 'up' | 'down' | 'auto' = 'auto'
): number => {
  const decimals = getTokenDecimals(tokenAddress);
  if (direction === 'auto') {
    return Number(amount.toFixed(decimals));
  }
  const factor = Math.pow(10, decimals);
  if (direction === 'up') {
    return Math.ceil(amount * factor) / factor;
  }
  // down
  return Math.floor(amount * factor) / factor;
};

/**
 * Format a token amount for display, showing up to the token's decimal precision
 * without trailing zeros.
 */
export const formatTokenAmount = (amount: number, tokenAddress: string): string => {
  const decimals = getTokenDecimals(tokenAddress);
  const rounded = Number(amount.toFixed(decimals));

  if (rounded >= 1000 && rounded < 1000000) {
    return `${(rounded / 1000).toFixed(1)}K`;
  }
  if (rounded >= 1000000) {
    return `${(rounded / 1000000).toFixed(2)}M`;
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(rounded);
};

export const formatNumber = (num: string | number): string => {
  if (typeof num === 'string') return num;

  if (num >= 1000 && num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatWalletAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatDuration = (totalSeconds: number): string => {
  const d = dayjs.duration(totalSeconds, 'seconds');
  const sec = d.asSeconds();
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) return `${Math.round(d.asMinutes())} min (${sec} sec)`;
  return `${d.asHours().toFixed(1)} hrs (${sec} sec)`;
};

export const formatDateTime = (timestamp: number): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};
