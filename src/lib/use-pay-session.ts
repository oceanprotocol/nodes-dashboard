import { CHAIN_ID } from '@/constants/chains';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { formatWalletAddress } from '@/utils/formatters';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

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
  handlePay: (params: PaySessionParams) => Promise<void>;
  error?: string;
}

/**
 * Single-step payment: deposits funds into escrow (if needed) and authorizes the spender in one
 * action. For smart accounts the approve + deposit + authorize calls are batched into a single
 * user confirmation. For EOAs they run sequentially (no batching available until the contract
 * exposes a bundle method).
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
        return;
      }

      const needsDeposit = new BigNumber(depositAmount ?? 0).gt(0);

      setIsPaying(true);
      setError(undefined);
      try {
        if (user?.type === 'eoa') {
          // EOA path: no batching, run the deposit (approve + deposit) then the authorize sequentially.
          if (!ocean) throw new Error('Wallet not ready');
          if (needsDeposit) {
            const depositTx = await ocean.depositTokensEoa({ tokenAddress, amount: depositAmount! });
            await depositTx.wait();
            posthog.capture('payment_deposit', { tokenAddress, amount: depositAmount });
          }
          const authorizeTx = await ocean.authorizeTokensEoa({
            tokenAddress,
            spender,
            maxLockedAmount,
            maxLockSeconds,
            maxLockCount,
          });
          await authorizeTx.wait();
          posthog.capture('payment_authorize');
        } else {
          // Smart account path: batch approve + deposit + authorize into a single confirmation.
          const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
          if (!config || !(config as any).Escrow) {
            throw new Error('No escrow found for chainId');
          }
          const escrowAddress = (config as any).Escrow as `0x${string}`;

          const tokenDecimals = await getTokenDecimals(tokenAddress);
          const toUnits = (amount: string) =>
            new BigNumber(amount).multipliedBy(new BigNumber(10).pow(Number(tokenDecimals))).toFixed(0);

          // Calls run in order within a single atomic user-operation: approve must precede deposit so
          // deposit observes the new allowance. The approve grants exactly the deposit amount (no
          // approveMax), so USDT-style "reset to 0 first" tokens with a stale allowance would revert;
          // the supported tokens (USDC/COMPY) don't enforce that. Until the Escrow exposes a bundle
          // method, this batch is the single-confirmation equivalent of the old two-step flow.
          const calls: { to: `0x${string}`; data: `0x${string}` }[] = [];

          if (needsDeposit) {
            const normalizedDeposit = toUnits(depositAmount!);
            calls.push({
              to: tokenAddress as `0x${string}`,
              data: encodeFunctionData({
                abi: ERC20Template.abi,
                functionName: 'approve',
                args: [escrowAddress, BigInt(normalizedDeposit)],
              }) as `0x${string}`,
            });
            calls.push({
              to: escrowAddress,
              data: encodeFunctionData({
                abi: Escrow.abi,
                functionName: 'deposit',
                args: [tokenAddress, BigInt(normalizedDeposit)],
              }) as `0x${string}`,
            });
          }

          calls.push({
            to: escrowAddress,
            data: encodeFunctionData({
              abi: Escrow.abi,
              functionName: 'authorize',
              args: [
                tokenAddress,
                spender,
                BigInt(toUnits(maxLockedAmount)),
                BigInt(maxLockSeconds),
                BigInt(maxLockCount),
              ],
            }) as `0x${string}`,
          });

          await sendTransaction(calls);

          if (needsDeposit) {
            posthog.capture('payment_deposit', { tokenAddress, amount: depositAmount });
          }
          posthog.capture('payment_authorize');
        }

        toast.success(paySuccessMessage(spender, peerId));
        onSuccess?.();
      } catch (err) {
        console.error('Pay session error:', err);
        setError(err instanceof Error ? err.message : 'Payment failed');
        toast.error('Payment failed. See console for details.');
      } finally {
        setIsPaying(false);
      }
    },
    [user?.type, ocean, sendTransaction, chainId, onSuccess]
  );

  return { isPaying, handlePay, error };
};

const paySuccessMessage = (consumerAddress: string, peerId?: string) => {
  const target = peerId
    ? `node ${formatWalletAddress(peerId)} (consumer ${formatWalletAddress(consumerAddress)})`
    : `consumer ${formatWalletAddress(consumerAddress)}`;
  return `Payment authorized for ${target}. Your session can start shortly.`;
};
