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
            setIsDepositing(false);
            return;
          }

          const signer = await provider.getSigner();
          const tx = await signer.sendTransaction({ to: nodeAddress, value: weiAmount });
          await tx.wait();
          setIsDepositing(false);
          setError(undefined);
          toast.success('Deposit successful!');
          onSuccess?.();
        } catch (err) {
          console.error('Deposit error:', err);
          setIsDepositing(false);
          const errorText = err instanceof Error ? err.message : 'Deposit failed';
          setError(errorText);
          toast.error(errorText);
        }
        return;
      }

      try {
        setIsDepositing(true);
        setError(undefined);

        await sendTransaction({
          to: nodeAddress as `0x${string}`,
          data: '0x' as `0x${string}`,
          value: weiAmount,
        });

        setIsDepositing(false);
        setError(undefined);
        toast.success('Deposit successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Deposit error:', err);
        setIsDepositing(false);
        const errorText = err instanceof Error ? err.message : 'Deposit failed';
        setError(errorText);
        toast.error(errorText);
      }
    },
    [user?.type, provider, sendTransaction, onSuccess]
  );

  return {
    isDepositing,
    handleDeposit,
    error,
  };
};
