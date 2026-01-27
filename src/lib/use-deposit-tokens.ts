import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSendUserOperation } from '@account-kit/react';
import { ethers } from 'ethers';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export interface DepositTokensParams {
  nodeAddress: string;
  amount: string;
}

export interface UseDepositTokensParams {
  onSuccess?: () => void;
}

export interface UseDepositTokensReturn {
  isDepositing: boolean;
  handleDeposit: (params: DepositTokensParams) => void;
  transactionUrl?: string;
  error?: string;
}

export const useDepositTokens = ({ onSuccess }: UseDepositTokensParams = {}): UseDepositTokensReturn => {
  const { client, provider, user } = useOceanAccount();

  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string>();

  const handleSuccess = () => {
    setIsDepositing(true);
    setError(undefined);
    toast.success('Deposit successful!');
    onSuccess?.();
  };

  const handleError = (error: any) => {
    console.error('Deposit error:', error);
    setIsDepositing(false);
    let prettyErr = '';
    if (error.details) {
      let d = 0,
        v = 0;
      const arr = error.details;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'D' && arr.slice(i, i + 7) === 'Details') {
          d = i;
        }
        if (arr[i] === 'V' && arr.slice(i, i + 7) === 'Version') {
          v = i;
        }
      }
      prettyErr = arr.slice(d + 8, v);
    }
    const errorText = prettyErr ?? error.details ?? 'Transfer failed';
    setError(errorText);
    toast.error(errorText);
  };

  const { sendUserOperationResult, sendUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
    onError: handleError,
    onSuccess: handleSuccess,
    onMutate: () => {
      setIsDepositing(true);
      setError(undefined);
    },
  });

  const handleDeposit = useCallback(
    async ({ nodeAddress, amount }: DepositTokensParams) => {
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
          const tx = await signer.sendTransaction({
            to: nodeAddress,
            value: weiAmount,
          });

          await tx.wait();
          handleSuccess();
        } catch (err) {
          handleError(err as Error);
        }

        return;
      }

      if (!client) {
        setError('Wallet not connected');
        toast.error('Wallet not connected');

        return;
      }

      sendUserOperation({
        uo: {
          target: nodeAddress as `0x${string}`,
          data: '0x' as `0x${string}`,
          value: weiAmount,
        },
      });
    },
    [user?.type, client, provider, sendUserOperation]
  );

  const transactionUrl = useMemo(() => {
    if (!client?.chain?.blockExplorers || !sendUserOperationResult?.hash) {
      return undefined;
    }
    return `${client.chain.blockExplorers.default.url}/tx/${sendUserOperationResult.hash}`;
  }, [client, sendUserOperationResult?.hash]);

  return {
    isDepositing,
    handleDeposit,
    transactionUrl,
    error,
  };
};
