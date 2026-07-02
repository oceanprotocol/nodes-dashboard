import { BASE_CHAIN_ID, CHAIN_ID } from '@/constants/chains';
import { ethers } from 'ethers';

export type EscrowContractVersion = 'current' | 'legacy';

// The Escrow contract was redeployed on Base, so users may still hold funds in the previous
// deployment. When this address is set, the escrow page offers a contract selector to view and
// withdraw those funds. Legacy access is Base-only: there is no old deployment with user funds
// on Sepolia, so the variable is ignored there.
const legacyEscrowEnv = process.env.NEXT_PUBLIC_LEGACY_ESCROW_ADDRESS;

export const LEGACY_ESCROW_ADDRESS: string | undefined =
  CHAIN_ID === BASE_CHAIN_ID && legacyEscrowEnv && ethers.isAddress(legacyEscrowEnv) ? legacyEscrowEnv : undefined;
