import { CHAIN_ID } from '@/constants/chains';
import { ComputeEnvironment } from '@/types/environments';

/**
 * Returns the supported tokens for a given environment.
 * @param environment The environment to get the supported tokens for.
 * @returns An array of supported tokens.
 */
export const getEnvSupportedTokens = (environment: ComputeEnvironment): string[] => {
  const fees = environment.fees[CHAIN_ID];
  if (!fees) {
    return [];
  }
  return fees.map((fee) => fee.feeToken);
};
