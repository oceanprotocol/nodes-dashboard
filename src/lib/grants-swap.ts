import { CHAIN_ID } from '@/constants/chains';
import { COMPY_PER_USDC } from '@/constants/tokens';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import { GrantsSwap } from '@oceanprotocol/lib';
import { ethers } from 'ethers';

/** GrantsSwap (COMPY swap) address for the active chain, from the contracts address book. */
export const getCompySwapAddress = (): string | undefined => {
  const config = Object.values(Address).find(
    (chainConfig) => (chainConfig as { chainId: number }).chainId === CHAIN_ID
  );
  return (config as { COMPYSwap?: string } | undefined)?.COMPYSwap;
};

/**
 * ocean.js wrapper bound to the active chain's GrantsSwap.
 *
 * The signer only has to actually sign on the EOA path. Reads and calldata encoding work off a
 * read-only `ethers.VoidSigner`, which is what the smart-account path passes — ocean.js builds its
 * contract instance from the signer, so a bare provider is not enough even for view calls.
 */
export const getGrantsSwap = (signer: ethers.Signer): GrantsSwap => {
  const address = getCompySwapAddress();
  if (!address) {
    throw new Error('No swap address found for chainId');
  }
  // Pass the chain explicitly: without it ocean.js resolves a null config and logs an error.
  return new GrantsSwap(address, signer, CHAIN_ID);
};

export interface SwapContractState {
  /** COMPY paid per 1 USDC. */
  rate: number;
  /** COMPY the contract still holds, i.e. the most any swap can pay out. `undefined` if unreadable. */
  compyLiquidity?: number;
  /** True only when the contract positively reports itself paused. */
  paused: boolean;
}

/**
 * Everything the swap form needs to validate an amount, read in one pass.
 *
 * Deployments older than `@oceanprotocol/contracts` 2.10.0 have none of these getters — Sepolia
 * still runs one, so each read falls back rather than blocking the form: the rate to
 * `COMPY_PER_USDC`, the liquidity cap to "unknown" (uncapped), and paused to false.
 */
export const readSwapContractState = async (provider: ethers.Provider): Promise<SwapContractState> => {
  const grantsSwap = getGrantsSwap(new ethers.VoidSigner(ethers.ZeroAddress, provider));

  const [rate, compyLiquidity, paused] = await Promise.all([
    grantsSwap
      .getRate()
      .then((value) => (Number(value) > 0 ? Number(value) : COMPY_PER_USDC))
      .catch((error) => {
        console.warn('[grants-swap] getRate() unavailable, falling back to COMPY_PER_USDC', error);
        return COMPY_PER_USDC;
      }),
    grantsSwap
      .getCompyToken()
      .then(async (compyToken) => {
        const units: bigint = await grantsSwap.contract.getCOMPYBalance();
        const decimals: bigint = await new ethers.Contract(
          compyToken,
          ['function decimals() view returns (uint8)'],
          provider
        ).decimals();
        return Number(ethers.formatUnits(units, Number(decimals)));
      })
      .catch(() => undefined),
    grantsSwap.contract.paused().catch(() => false) as Promise<boolean>,
  ]);

  return { rate, compyLiquidity, paused };
};
