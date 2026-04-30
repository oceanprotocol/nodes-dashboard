import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
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
    async ({ tokenAddress, toAddress, amount }: TransferTokensParams) => {
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(toAddress)) {
        const errorText = 'Invalid address';
        setError(errorText);
        toast.error(errorText);
        return;
      }

      if (user?.type === 'eoa') {
        try {
          setIsTransferring(true);
          if (!provider) return;
          const tokenDecimals = await getTokenDecimals(tokenAddress);
          const normalizedAmount = new BigNumber(amount)
            .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
            .toFixed(0);

          const signer = await provider.getSigner();
          const tokenWithSigner = new ethers.Contract(tokenAddress, ERC20Template.abi, signer);
          const tx = await tokenWithSigner.transfer(toAddress, normalizedAmount);
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

        const tokenDecimals = await getTokenDecimals(tokenAddress);
        const normalizedAmount = new BigNumber(amount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        const data = encodeFunctionData({
          abi: ERC20Template.abi,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, BigInt(normalizedAmount)],
        });

        await sendTransaction({
          to: tokenAddress as `0x${string}`,
          data: data as `0x${string}`,
        });

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
