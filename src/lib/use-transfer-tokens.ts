import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

export interface TransferTokensParams {
  tokenAddress: string;
  toAddress: string;
  amount: string;
  /** Native chain currency (ETH) — sent as tx value instead of an ERC20 transfer call. */
  isNative?: boolean;
  decimals?: number;
}

export interface UseTransferTokensParams {
  onSuccess?: () => void;
}

export interface UseTransferTokensReturn {
  isTransferring: boolean;
  handleTransfer: (params: TransferTokensParams) => void;
  transactionUrl?: string;
  error?: string;
}

export const useTransferTokens = ({ onSuccess }: UseTransferTokensParams = {}): UseTransferTokensReturn => {
  const { provider, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string>();

  const handleTransfer = useCallback(
    async ({ tokenAddress, toAddress, amount, isNative, decimals }: TransferTokensParams) => {
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(toAddress)) {
        const errorText = 'Invalid address';
        setError(errorText);
        toast.error(errorText);
        return;
      }

      const getNormalizedAmount = async () => {
        const tokenDecimals = isNative ? (decimals ?? 18) : await getTokenDecimals(tokenAddress);
        return new BigNumber(amount).multipliedBy(new BigNumber(10).pow(Number(tokenDecimals))).toFixed(0);
      };

      if (user?.type === 'eoa') {
        try {
          setIsTransferring(true);
          if (!provider) return;
          const normalizedAmount = await getNormalizedAmount();

          const signer = await provider.getSigner();
          const tx = isNative
            ? await signer.sendTransaction({ to: toAddress, value: BigInt(normalizedAmount) })
            : await new ethers.Contract(tokenAddress, ERC20Template.abi, signer).transfer(toAddress, normalizedAmount);
          await tx.wait();
          setIsTransferring(false);
          setError(undefined);
          toast.success('Transfer successful!');
          onSuccess?.();
        } catch (err) {
          console.error('Transfer error:', err);
          setIsTransferring(false);
          const errorText = err instanceof Error ? err.message : 'Transfer failed';
          setError(errorText);
          toast.error(errorText);
        }
        return;
      }

      if (!tokenAddress || !toAddress || !amount) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        setIsTransferring(true);
        setError(undefined);

        const normalizedAmount = await getNormalizedAmount();

        if (isNative) {
          await sendTransaction({
            to: toAddress as `0x${string}`,
            value: BigInt(normalizedAmount),
          });
        } else {
          const data = encodeFunctionData({
            abi: ERC20Template.abi,
            functionName: 'transfer',
            args: [toAddress as `0x${string}`, BigInt(normalizedAmount)],
          });

          await sendTransaction({
            to: tokenAddress as `0x${string}`,
            data: data as `0x${string}`,
          });
        }

        setIsTransferring(false);
        setError(undefined);
        toast.success('Transfer successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Transfer error:', err);
        setIsTransferring(false);

        const isTimeout =
          err instanceof Error &&
          (err.message.includes('Timed out') ||
            err.message.includes('Failed to find User Operation') ||
            err.message.includes('to be confirmed'));

        if (isTimeout) {
          setError(undefined);
          toast.warning(
            'Transaction submitted but confirmation is taking longer than expected. It may still complete — please check your wallet balance shortly.',
            { autoClose: 8000 }
          );
          onSuccess?.();
          return;
        }

        const errorText = err instanceof Error ? err.message : 'Transfer failed';
        setError(errorText);
        toast.error(errorText);
      }
    },
    [user?.type, provider, sendTransaction, onSuccess]
  );

  return {
    isTransferring,
    handleTransfer,
    error,
  };
};
