import { getSupportedTokens } from '@/constants/tokens';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

/**
 * Get the number of decimals for a known token from tokenAddressesByChainId, by its address.
 * Falls back to 6 if the token is not in tokenAddressesByChainId.
 */
const getTokenDecimals = (tokenAddress: string): number => {
  const tokens = getSupportedTokens();
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

/**
 * Format a duration in seconds to a human-readable format.
 * If the duration is less than 1 minute, will be displayed in seconds.
 * If the duration can be divided in hours, will be displayed in hours.
 * If the duration can be divided in minutes, will be displayed in minutes (and hh:mm:ss if > 1 hour)
 *
 * Examples:
 * 5400s → 90 minutes (01:30:00);
 * 3661s → 3661 seconds (01:01:01);
 * 3660s → 61 minutes (01:01:00);
 * 3600s → 1 hour;
 * 90s → 90 seconds (00:01:30);
 * 60s → 1 minute;
 *
 * @param totalSeconds duration in seconds; if null or undefined, it will be treated as 0
 * @param short if true, the units will be shorter (h instead of hours, m instead of minutes, s instead of seconds)
 * @returns formatted duration string
 */
export const formatDuration = (totalSeconds: number | null | undefined, short?: boolean): string => {
  const sec = Math.round(totalSeconds ?? 0);
  // if the duration can be divided in hours, show it in hours
  if (sec % 3600 === 0 && sec >= 3600) {
    const hours = sec / 3600;
    const hUnit = short ? 'h' : hours === 1 ? 'hour' : 'hours';
    return `${hours} ${hUnit}`;
  }
  // if the duration can be divided in minutes, show it in minutes (+ hh:mm:ss if > 1 hour)
  if (sec % 60 === 0 && sec >= 60) {
    const minutes = sec / 60;
    const mUnit = short ? 'm' : minutes === 1 ? 'minute' : 'minutes';
    const formattedMinutes = `${minutes} ${mUnit}`;
    if (sec < 3600) {
      // if the duration is less than 1 hour, show it in minutes
      return formattedMinutes;
    }
    // if the duration is less than 1 day, show it in minutes + hh:mm:ss
    return `${formattedMinutes} (${dayjs.duration(sec, 'seconds').format('HH:mm:ss')})`;
  }
  const sUnit = short ? 's' : sec === 1 ? 'second' : 'seconds';
  // if the duration is less than 1 minute, show it in seconds
  if (sec < 60) {
    return `${sec} ${sUnit}`;
  }
  // duration cannot be divided in hours or minutes, but is > 1 minute, show it in seconds and hh:mm:ss
  return `${sec} ${sUnit} (${dayjs.duration(sec, 'seconds').format('HH:mm:ss')})`;
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
