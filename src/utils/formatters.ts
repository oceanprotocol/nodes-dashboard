import { CHAIN_LABELS } from '@/constants/chains';
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
 * How many decimals a token amount actually uses, after rounding to the token's precision.
 * `1.5` -> 1, `1` -> 0, `0.004` -> 3.
 */
export const tokenAmountDecimals = (amount: number, tokenAddress: string): number => {
  const rounded = Number(amount.toFixed(getTokenDecimals(tokenAddress)));
  const [, fraction = ''] = String(rounded).split('.');
  return fraction.length;
};

/**
 * The decimals needed to render a group of amounts with the same precision: the most any single
 * value actually uses. Use for a column of amounts that should line up on the decimal point.
 */
export const sharedTokenAmountDecimals = (amounts: number[], tokenAddress: string): number =>
  amounts.reduce((max, amount) => Math.max(max, tokenAmountDecimals(amount, tokenAddress)), 0);

/**
 * Format a token amount for display, showing up to the token's decimal precision
 * without trailing zeros.
 *
 * Pass `fractionDigits` to always render exactly that many decimals (no K/M
 * abbreviation), so a column of values lines up on the decimal point.
 */
export const formatTokenAmount = (amount: number, tokenAddress: string, fractionDigits?: number): string => {
  const decimals = getTokenDecimals(tokenAddress);
  const rounded = Number(amount.toFixed(decimals));

  if (fractionDigits !== undefined) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(rounded);
  }

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

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatWalletAddress = (address: string): string => {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Seconds as HH:MM:SS. Clamped at zero so a live countdown that momentarily reads negative (the
 * local tick can run a hair past the authoritative deadline) renders 00:00:00 rather than -00:00:01.
 */
export const formatHMS = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    return `${formattedMinutes} (${formatHMS(sec)})`;
  }
  const sUnit = short ? 's' : sec === 1 ? 'second' : 'seconds';
  // if the duration is less than 1 minute, show it in seconds
  if (sec < 60) {
    return `${sec} ${sUnit}`;
  }
  // duration cannot be divided in hours or minutes, but is > 1 minute, show it in seconds and hh:mm:ss
  return `${sec} ${sUnit} (${formatHMS(sec)})`;
};

/**
 * An AGGREGATE reserved duration, rendered in hours.
 *
 * Separate from formatDuration because that one is built for a single job or
 * session and falls back to `"5400 seconds (01:30:00)"` whenever the value is
 * not a clean multiple of an hour or minute. Reserved totals are millions of
 * seconds, where that output is unreadable — so this abbreviates through
 * formatNumber instead ("1.2K hrs").
 *
 * The word "reserved" is deliberate: this is PURCHASED time, not time a
 * container actually ran. The node does not record the latter.
 */
export const formatReservedHours = (totalSeconds: number | null | undefined): string => {
  const sec = totalSeconds ?? 0;
  if (!Number.isFinite(sec) || sec <= 0) {
    return '0 hrs';
  }
  const hours = sec / 3600;
  // Sub-hour totals would abbreviate to "0 hrs" and read as "nothing happened".
  if (hours < 1) {
    return '< 1 hr';
  }
  return `${formatNumber(Math.round(hours))} hrs`;
};

/**
 * Total wall-clock duration of a compute job (in seconds): dateFinished - dateCreated.
 * Timestamps arrive as unix-seconds strings (e.g. "1784196420.452"), so they are
 * coerced to numbers. Returns null while the job is unfinished or the values are invalid.
 */
export const getJobDurationSeconds = (job: {
  dateCreated?: number | string | null;
  dateFinished?: number | string | null;
}): number | null => {
  const start = Number(job.dateCreated);
  const finished = Number(job.dateFinished);
  if (!Number.isFinite(start) || !Number.isFinite(finished) || finished <= start) {
    return null;
  }
  return finished - start;
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

/**
 * Title-case a Hugging Face pipeline tag for display (e.g. `text-generation` → "Text Generation").
 * `fallback` is returned for a missing tag — callers pass what reads best in their context
 * ("Model", "Other").
 */
export const formatPipelineTag = (tag: string | undefined, fallback: string): string => {
  if (!tag) {
    return fallback;
  }
  return tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export type HardwareType = 'cpu' | 'gpu';

// Manufacturer/noise words dropped from a CPU/GPU model string; the brand is shown as a logo
// instead. Keeps the useful model bits (e.g. "H200", "Xeon Platinum 8480+", "Ryzen 9 5950X").
const HW_BRANDING = [
  'nvidia',
  'amd',
  'intel',
  'advanced',
  'micro',
  'devices',
  'inc',
  'corporation',
  'processor',
  'cpu',
];
const GPU_VENDORS = ['nvidia', 'amd', 'intel'] as const;
type GpuVendor = (typeof GPU_VENDORS)[number];

export const formatHardwareName = (
  name: string,
  type: HardwareType,
  { showVendor = false }: { showVendor?: boolean } = {}
): string => {
  const detectedVendor = GPU_VENDORS.find((v) => name.toLowerCase().includes(v)) as GpuVendor | undefined;
  // CPU model strings carry meaningful dots (clock speed, e.g. "2.60GHz"); GPU names don't.
  const splitter = type === 'cpu' ? /[\s,]+/ : /[\s,.]+/;
  const filtered = name
    // Strip trademark marks glued to words, e.g. "Intel(R)" / "Core(TM)".
    .replace(/\((?:r|tm)\)/gi, ' ')
    .split(splitter)
    .filter((word) => word && !HW_BRANDING.includes(word.toLowerCase()))
    .join(' ')
    .trim();
  if (showVendor && detectedVendor) {
    return `${detectedVendor.charAt(0).toUpperCase()}${detectedVendor.slice(1)} ${filtered}`.trim();
  }
  return filtered;
};

export const formatChainLabel = (chainId: number | string) => {
  return `${CHAIN_LABELS[Number(chainId)] ?? 'Chain'} (${chainId})`;
};

export const formatAccessLists = (
  accessLists: { [chainId: string]: string[] }[],
  options?: { shortenAddresses?: boolean }
): string[] => {
  const labels: string[] = [];
  for (const accessList of accessLists) {
    for (const chainId of Object.keys(accessList)) {
      const chainLabel = formatChainLabel(chainId);
      for (const address of accessList[chainId]) {
        const displayAddress = options?.shortenAddresses ? formatWalletAddress(address) : address;
        labels.push(`${chainLabel} / ${displayAddress}`);
      }
    }
  }
  return labels;
};

/**
 * Format Alchemy/Ethers errors
 * @param error - Error object
 * @param fallback - Fallback error message
 * @returns Formatted error message
 */
export function formatError({ error, fallback }: { error: unknown; fallback?: string }): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? 'Unknown error');
  }
  const e = error as Record<string, any>;
  // ethers ACTION_REJECTED
  if (e.code === 'ACTION_REJECTED') {
    return 'The action was rejected by the user.';
  }
  // ethers CALL_EXCEPTION with reason
  if (e.code === 'CALL_EXCEPTION' && e.reason) {
    return `Contract error: ${e.reason}`;
  }
  // ethers SERVER_ERROR / NETWORK_ERROR
  if (e.code === 'SERVER_ERROR' || e.code === 'NETWORK_ERROR') {
    return 'A network error occurred. Please try again.';
  }
  if (e?.shortMessage) {
    return e.shortMessage;
  }
  if (e?.message) {
    return e.message;
  }
  // Alchemy / JSON-RPC error with nested message
  if (e?.error?.message) {
    return e.error.message;
  }
  // Standard Error.message — strip ethers version suffix and raw params
  if (typeof e.message === 'string') {
    return e.message
      .split(' (action=')[0]
      .replace(/^ethers-[^:]+:\s*/i, '')
      .trim();
  }
  return fallback ?? 'Something went wrong. Please try again.';
}
