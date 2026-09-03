import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { ComputeEnvironment } from '@/types/environments';

/**
 * Returns the supported tokens for a given environment.
 * @param environment The environment to get the supported tokens for.
 * @param supportedOnly Whether to return only supported tokens (USDC & COMPY).
 * @returns An array of supported tokens.
 */
export const getEnvSupportedTokens = (environment: ComputeEnvironment, supportedOnly?: boolean): string[] => {
  const fees = environment.fees?.[CHAIN_ID];

  if (!fees) {
    return [];
  }

  const tokenAddresses = fees.map((fee) => fee.feeToken);
  if (!supportedOnly) {
    return tokenAddresses;
  }

  const supportedTokens = Object.values(getSupportedTokens()).map((t) => t.address);

  return tokenAddresses.filter((address) => supportedTokens.includes(address));
};

/**
 * Seed fee token for an auto-matched environment card: USDC when the env accepts it, else the first
 * supported paid token (null when it accepts none). Mirrors the env card's own getDefaultToken so both
 * agree on the seed before the user switches it there.
 */
export const pickDefaultToken = (supportedTokens: string[]): string | null => {
  const usdc = getSupportedTokens().USDC.address;
  if (supportedTokens.some((t) => t.toLowerCase() === usdc.toLowerCase())) {
    return usdc;
  }
  return supportedTokens[0] ?? null;
};
