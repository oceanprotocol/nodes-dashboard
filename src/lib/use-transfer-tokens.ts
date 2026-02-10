import { RPC_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSendUserOperation } from '@account-kit/react';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useCallback, useMemo, useState } from 'react';
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
  const { client, ocean, provider, user } = useOceanAccount();

  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string>();

  const handleSuccess = () => {
    setIsTransferring(false);
    setError(undefined);
    toast.success('Transfer successful!');
    onSuccess?.();
  };

  const handleError = (error: any) => {
    console.error('Transfer error:', error);
    setIsTransferring(false);
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
      setIsTransferring(true);
      setError(undefined);
    },
  });

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
          if (!provider) {
            return;
          }
          const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, rpcProvider);
          const tokenDecimals = await tokenContract.decimals();
          const normalizedAmount = new BigNumber(amount)
            .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
            .toFixed(0);

          const signer = await provider.getSigner();
          const tokenWithSigner = new ethers.Contract(tokenAddress, ERC20Template.abi, signer);
          const tx = await tokenWithSigner.transfer(toAddress, normalizedAmount);
          await tx.wait();
          handleSuccess();
        } catch (error) {
          handleError(error as Error);
        }
        return;
      }

      if (!client) {
        setError('Wallet not connected');
        toast.error('Wallet not connected');
        return;
      }

      if (!tokenAddress || !toAddress || !amount) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, rpcProvider);
        const tokenDecimals = await tokenContract.decimals();

        const normalizedAmount = new BigNumber(amount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        const data = encodeFunctionData({
          abi: ERC20Template.abi,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, BigInt(normalizedAmount)],
        });

        sendUserOperation({
          uo: {
            target: tokenAddress as `0x${string}`,
            data: data as `0x${string}`,
          },
        });
      } catch (err) {
        console.error('Error preparing transfer:', err);
        const errorText = err instanceof Error ? err.message : 'Failed to prepare transfer';
        setError(errorText);
        toast.error(errorText);
        setIsTransferring(false);
      }
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
    isTransferring,
    handleTransfer,
    transactionUrl,
    error,
  };
};
