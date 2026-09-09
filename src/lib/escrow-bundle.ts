import Address from '@oceanprotocol/contracts/addresses/address.json';
import BigNumber from 'bignumber.js';

// Single source of truth for Escrow.bundle arguments (contracts >= 2.9.0). Both the EOA (ethers)
// and smart-account (viem) payment paths build their call args here, so the tuple shapes — which
// must match Escrow.sol's DepositData/PermitData/AuthData structs exactly — cannot drift apart.

export type EscrowDeposit = { token: string; amount: bigint };

export type EscrowDepositPermit = {
  token: string;
  amount: bigint;
  deadline: bigint;
  v: number;
  r: string;
  s: string;
};

export type EscrowAuth = {
  token: string;
  payee: string;
  maxLockedAmount: bigint;
  maxLockSeconds: bigint;
  maxLockCounts: bigint;
};

export type EscrowBundleArgs = {
  deposits: EscrowDeposit[];
  permits: EscrowDepositPermit[];
  auths: EscrowAuth[];
};

// Human-denominated amount -> token base units.
export const toBaseUnits = (amount: string, decimals: number | bigint): bigint =>
  BigInt(new BigNumber(amount).multipliedBy(new BigNumber(10).pow(Number(decimals))).toFixed(0));

export function getEscrowAddressForChain(chainId: number): string {
  const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
  const escrowAddress = (config as any)?.Escrow;
  if (!escrowAddress) {
    throw new Error(`No escrow contract found for chainId ${chainId}`);
  }
  return escrowAddress as string;
}

export function buildEscrowBundleArgs({
  depositAmount,
  maxLockCount,
  maxLockedAmount,
  maxLockSeconds,
  permit,
  spender,
  tokenAddress,
  tokenDecimals,
}: {
  // Human-denominated deposit; ignored when a permit is provided (the permit already funds it).
  depositAmount?: string;
  maxLockCount: string;
  maxLockedAmount: string;
  maxLockSeconds: string;
  permit?: EscrowDepositPermit | null;
  spender: string;
  tokenAddress: string;
  tokenDecimals: number | bigint;
}): EscrowBundleArgs {
  const deposits: EscrowDeposit[] = [];
  if (!permit && depositAmount && new BigNumber(depositAmount).gt(0)) {
    deposits.push({ token: tokenAddress, amount: toBaseUnits(depositAmount, tokenDecimals) });
  }
  return {
    deposits,
    permits: permit ? [permit] : [],
    auths: [
      {
        token: tokenAddress,
        payee: spender,
        maxLockedAmount: toBaseUnits(maxLockedAmount, tokenDecimals),
        maxLockSeconds: BigInt(maxLockSeconds),
        maxLockCounts: BigInt(maxLockCount),
      },
    ],
  };
}
