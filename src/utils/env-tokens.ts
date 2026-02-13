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
  const fees = environment.fees[CHAIN_ID];

  if (!fees) {
    return [];
  }

  const tokenAddresses = fees.map((fee) => fee.feeToken);
  if (!supportedOnly) {
    return tokenAddresses;
  }

  const supportedTokens = Object.values(getSupportedTokens());

  return tokenAddresses.filter((address) => supportedTokens.includes(address));
};
