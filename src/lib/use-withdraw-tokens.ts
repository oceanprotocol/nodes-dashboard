import { CHAIN_ID } from '@/constants/chains';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import BigNumber from 'bignumber.js';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

export interface WithdrawTokensParams {
  tokenAddresses: string[];
  amounts: string[];
}

export interface UseWithdrawTokensParams {
  onSuccess?: () => void;
}

export interface UseWithdrawTokensReturn {
  isWithdrawing: boolean;
  handleWithdraw: (params: WithdrawTokensParams) => void;
  transactionUrl?: string;
  error?: string;
}

export const useWithdrawTokens = ({ onSuccess }: UseWithdrawTokensParams = {}): UseWithdrawTokensReturn => {
  const { ocean, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string>();
  const [transactionUrl, setTransactionUrl] = useState<string | undefined>(undefined);
  const chainId = CHAIN_ID;

  const handleWithdraw = useCallback(
    async ({ tokenAddresses, amounts }: WithdrawTokensParams) => {
      if (user?.type === 'eoa') {
        try {
          setIsWithdrawing(true);
          if (!ocean) return;
          const tx = await ocean.withdrawTokensEoa({ tokenAddresses, amounts });
          await tx.wait();
          toast.success('Withdraw successful!');
          onSuccess?.();
        } catch (err) {
          console.error('Withdraw error:', err);
          setError(err instanceof Error ? err.message : 'Withdraw failed');
          toast.error('Withdraw failed');
        } finally {
          setIsWithdrawing(false);
        }
        return;
      }

      if (tokenAddresses.length !== amounts.length) return;

      try {
        setIsWithdrawing(true);
        setError(undefined);

        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
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

        const result = await sendTransaction({
          to: (config as any).Escrow as `0x${string}`,
          data: data as `0x${string}`,
        });

        const explorerBase =
          process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'https://basescan.org' : 'https://sepolia.etherscan.io';
        setTransactionUrl(`${explorerBase}/tx/${result.txnHash}`);

        toast.success('Withdraw successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Withdraw error:', err);
        const errorText =
          (err as any)?.details?.match(/Details:\s*(.*?)\s*Version:/)?.[1] ||
          (err as any)?.details ||
          (err instanceof Error ? err.message : 'Withdraw failed');
        setError(errorText);
        toast.error(errorText);
      } finally {
        setIsWithdrawing(false);
      }
    },
    [user?.type, ocean, sendTransaction, onSuccess, chainId]
  );

  return {
    isWithdrawing,
    handleWithdraw,
    transactionUrl,
    error,
  };
};
