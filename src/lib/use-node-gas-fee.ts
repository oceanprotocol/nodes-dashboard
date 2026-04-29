import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
import { ethers } from 'ethers';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

export interface GasFeeParams {
  nodeAddress: string;
  amount: string;
}

export interface UseGasFeeParams {
  onSuccess?: () => void;
}

export interface UseGasFeeReturn {
  isDepositing: boolean;
  handleDeposit: (params: GasFeeParams) => void;
  transactionUrl?: string;
  error?: string;
}

export const useGasFee = ({ onSuccess }: UseGasFeeParams = {}): UseGasFeeReturn => {
  const { provider, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string>();
  const [transactionUrl, setTransactionUrl] = useState<string | undefined>(undefined);

  const handleDeposit = useCallback(
    async ({ nodeAddress, amount }: GasFeeParams) => {
      if (!nodeAddress || !amount) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      if (!ethers.isAddress(nodeAddress)) {
        setError('Invalid node address');
        toast.error('Invalid node address');
        return;
      }

      const weiAmount = ethers.parseEther(amount);

      if (user?.type === 'eoa') {
        try {
          setIsDepositing(true);
          if (!provider) {
            setError('Provider not available');
            toast.error('Provider not available');
            return;
          }
          const signer = await provider.getSigner();
          const tx = await signer.sendTransaction({ to: nodeAddress, value: weiAmount });
          await tx.wait();
          toast.success('Deposit successful!');
          onSuccess?.();
        } catch (err) {
          console.error('Deposit error:', err);
          setError(err instanceof Error ? err.message : 'Transfer failed');
          toast.error('Transfer failed');
        } finally {
          setIsDepositing(false);
        }
        return;
      }

      try {
        setIsDepositing(true);
        setError(undefined);

        const result = await sendTransaction({
          to: nodeAddress as `0x${string}`,
          data: '0x' as `0x${string}`,
          value: weiAmount,
        });

        const explorerBase =
          process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'https://basescan.org' : 'https://sepolia.etherscan.io';
        setTransactionUrl(`${explorerBase}/tx/${result.txnHash}`);

        toast.success('Deposit successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Deposit error:', err);
        const errorText =
          (err as any)?.details?.match(/Details:\s*(.*?)\s*Version:/)?.[1] ||
          (err as any)?.details ||
          (err instanceof Error ? err.message : 'Transfer failed');
        setError(errorText);
        toast.error(errorText);
      } finally {
        setIsDepositing(false);
      }
    },
    [user?.type, provider, sendTransaction, onSuccess]
  );

  return {
    isDepositing,
    handleDeposit,
    transactionUrl,
    error,
  };
};
