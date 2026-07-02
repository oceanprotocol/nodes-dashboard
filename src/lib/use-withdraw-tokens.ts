import { CHAIN_ID } from '@/constants/chains';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import BigNumber from 'bignumber.js';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

export interface WithdrawTokensParams {
  tokenAddresses: string[];
  amounts: string[];
  // Withdraw from this escrow deployment instead of the one in address.json (legacy contract).
  escrowAddress?: string;
}

export interface UseWithdrawTokensParams {
  onSuccess?: () => void;
}

export interface UseWithdrawTokensReturn {
  isWithdrawing: boolean;
  handleWithdraw: (params: WithdrawTokensParams) => Promise<void>;
  transactionUrl?: string;
  error?: string;
}

export const useWithdrawTokens = ({ onSuccess }: UseWithdrawTokensParams = {}): UseWithdrawTokensReturn => {
  const { ocean, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string>();
  const chainId = CHAIN_ID;

  const handleWithdraw = useCallback(
    async ({ tokenAddresses, amounts, escrowAddress }: WithdrawTokensParams) => {
      if (user?.type === 'eoa') {
        try {
          setIsWithdrawing(true);
          if (!ocean) return;
          const tx = await ocean.withdrawTokensEoa({ tokenAddresses, amounts, escrowAddress });
          await tx.wait();
          setIsWithdrawing(false);
          setError(undefined);
          toast.success('Withdraw successful!');
          onSuccess?.();
        } catch (err) {
          console.error('Withdraw error:', err);
          setIsWithdrawing(false);
          const errorText = err instanceof Error ? err.message : 'Withdraw failed';
          setError(errorText);
          toast.error(errorText);
        }
        return;
      }

      if (tokenAddresses.length !== amounts.length) return;

      try {
        setIsWithdrawing(true);
        setError(undefined);

        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        const escrowTarget = escrowAddress ?? (config as any)?.Escrow;
        if (!escrowTarget) {
          throw new Error('No escrow found for chainId');
        }

        const normalizedAmounts = [];
        for (let i = 0; i < tokenAddresses.length; i++) {
          const tokenDecimals = await getTokenDecimals(tokenAddresses[i]);
          normalizedAmounts.push(
            BigInt(new BigNumber(amounts[i]).multipliedBy(new BigNumber(10).pow(Number(tokenDecimals))).toFixed(0))
          );
        }

        const data = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'withdraw',
          args: [tokenAddresses, normalizedAmounts],
        });

        await sendTransaction({
          to: escrowTarget as `0x${string}`,
          data: data as `0x${string}`,
        });

        setIsWithdrawing(false);
        setError(undefined);
        toast.success('Withdraw successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Withdraw error:', err);
        setIsWithdrawing(false);
        const errorText = err instanceof Error ? err.message : 'Withdraw failed';
        setError(errorText);
        toast.error(errorText);
      }
    },
    [user?.type, ocean, sendTransaction, chainId, onSuccess]
  );

  return {
    isWithdrawing,
    handleWithdraw,
    error,
  };
};
