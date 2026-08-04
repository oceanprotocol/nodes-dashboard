import { CHAIN_ID } from '@/constants/chains';
import { buildEscrowBundleArgs, getEscrowAddressForChain } from '@/lib/escrow-bundle';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatWalletAddress } from '@/utils/formatters';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

/** Lock slots granted when (re)authorizing — shared default for all payment flows. */
export const DEFAULT_MAX_LOCK_COUNT = 10;

export interface PaySessionParams {
  tokenAddress: string;
  peerId?: string;
  spender: string;
  // Amount to deposit into escrow. Pass "0" (or omit) when escrow already holds enough.
  depositAmount?: string;
  maxLockedAmount: string;
  maxLockSeconds: string;
  maxLockCount: string;
}

export interface UsePaySessionParams {
  onSuccess?: () => void;
}

export interface UsePaySessionReturn {
  isPaying: boolean;
  /** Resolves true when the payment transaction(s) succeeded, false otherwise (error is toasted). */
  handlePay: (params: PaySessionParams) => Promise<boolean>;
  error?: string;
}

/**
 * Single-step payment: deposits funds into escrow (if needed) and authorizes the spender in one
 * action via Escrow.bundle (contracts >= 2.9.0), which folds deposit + authorize into one contract
 * call. For smart accounts the approve + bundle calls are batched into a single user confirmation.
 * For EOAs the approve runs first (no batching), then the single bundle tx does deposit + authorize.
 */
export const usePaySession = ({ onSuccess }: UsePaySessionParams = {}): UsePaySessionReturn => {
  const { ocean, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string>();
  const chainId = CHAIN_ID;

  const handlePay = useCallback(
    async ({
      tokenAddress,
      peerId,
      spender,
      depositAmount,
      maxLockedAmount,
      maxLockSeconds,
      maxLockCount,
    }: PaySessionParams) => {
      if (!tokenAddress || !spender) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return false;
      }

      const needsDeposit = new BigNumber(depositAmount ?? 0).gt(0);

      setIsPaying(true);
      setError(undefined);
      try {
        if (user?.type === 'eoa') {
          // EOA path: single bundle tx does deposit + authorize. It approves the escrow first when a
          // deposit is needed (EOAs can't batch), then folds deposit + authorize into one tx.
          if (!ocean) throw new Error('Wallet not ready');
          const bundleTx = await ocean.bundleDepositAuthorizeEoa({
            tokenAddress,
            depositAmount: needsDeposit ? depositAmount : undefined,
            spender,
            maxLockedAmount,
            maxLockSeconds,
            maxLockCount,
          });
          await bundleTx.wait();
          if (needsDeposit) {
            posthog.capture('payment_deposit', { tokenAddress, amount: depositAmount });
          }
          posthog.capture('payment_authorize');
        } else {
          const escrowAddress = getEscrowAddressForChain(chainId) as `0x${string}`;
          const tokenDecimals = await getTokenDecimals(tokenAddress);

          const args = buildEscrowBundleArgs({
            depositAmount: needsDeposit ? depositAmount : undefined,
            maxLockCount,
            maxLockedAmount,
            maxLockSeconds,
            spender,
            tokenAddress,
            tokenDecimals,
          });

          const calls: { to: `0x${string}`; data: `0x${string}` }[] = [
            // Smart accounts can't produce an EIP-2612 permit (ecrecover-based), so a deposit is
            // funded by an approve batched atomically with the bundle in one user-op.
            ...args.deposits.map((deposit) => ({
              to: deposit.token as `0x${string}`,
              data: encodeFunctionData({
                abi: ERC20Template.abi,
                functionName: 'approve',
                args: [escrowAddress, deposit.amount],
              }) as `0x${string}`,
            })),
            {
              to: escrowAddress,
              data: encodeFunctionData({
                abi: Escrow.abi,
                functionName: 'bundle',
                args: [args.deposits, args.permits, args.auths],
              }) as `0x${string}`,
            },
          ];

          await sendTransaction(calls);

          if (needsDeposit) {
            posthog.capture('payment_deposit', { tokenAddress, amount: depositAmount });
          }
          posthog.capture('payment_authorize');
        }

        toast.success(paySuccessMessage(
          // spender, peerId
        ));
        onSuccess?.();
        return true;
      } catch (err) {
        console.error('Pay session error:', err);
        const message = err instanceof Error && err.message ? err.message : 'Payment failed';
        setError(message);
        toast.error(`Payment failed: ${message}`);
        return false;
      } finally {
        setIsPaying(false);
      }
    },
    [user?.type, ocean, sendTransaction, chainId, onSuccess]
  );

  return { isPaying, handlePay, error };
};

const paySuccessMessage = (
  // consumerAddress: string, 
  // peerId?: string
) => {
  return "Payment authorized. Your updated service will be available shortly.";
  // const target = peerId
  // ? `node ${formatWalletAddress(peerId)} (consumer ${formatWalletAddress(consumerAddress)})`
  // : `consumer ${formatWalletAddress(consumerAddress)}`;
  // return `Payment authorized for ${target}. Your updated service will be available shortly.`;
};
