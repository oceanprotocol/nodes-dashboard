import { CHAIN_ID } from '@/constants/chains';
import { isUsdc } from '@/constants/tokens';
import { ComputeEnvFees, ComputeEnvironment } from '@/types/environments';

/** The environment's USDC fee schedule on the active chain, if it accepts USDC. */
export const getEnvUsdcFees = (fees: ComputeEnvironment['fees']): ComputeEnvFees | undefined =>
  fees?.[CHAIN_ID]?.find((fee) => isUsdc(fee.feeToken));

export const acceptsUsdc = (environment: ComputeEnvironment): boolean => !!getEnvUsdcFees(environment.fees);
