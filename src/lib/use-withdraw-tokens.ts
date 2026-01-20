import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSendUserOperation } from '@account-kit/react';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useCallback, useMemo, useState } from 'react';
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
  const { client } = useOceanAccount();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string>();
  const chainId = CHAIN_ID;

  const handleSuccess = () => {
    setIsWithdrawing(false);
    setError(undefined);
    toast.success('Withdraw successful!');
    onSuccess?.();
  };

  const handleError = (error: any) => {
    console.error('Withdraw error:', error);
    setIsWithdrawing(false);
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
    const errorText = prettyErr ?? error.details ?? 'Withdraw failed';
    setError(errorText);
    toast.error(errorText);
  };

  const { sendUserOperationResult, sendUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
    onError: handleError,
    onSuccess: handleSuccess,
    onMutate: () => {
      setIsWithdrawing(true);
      setError(undefined);
    },
  });

  const handleWithdraw = useCallback(
    async ({ tokenAddresses, amounts }: WithdrawTokensParams) => {
      if (!client) return;
      if (tokenAddresses.length !== amounts.length) return;

      try {
        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          throw new Error('No escrow found for chainId');
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const normalizedAmounts = [];
        for (let i = 0; i < tokenAddresses.length; i++) {
          const tokenContract = new ethers.Contract(tokenAddresses[i], ERC20Template.abi, provider);
          const tokenDecimals = await tokenContract.decimals();

          normalizedAmounts.push(
            BigInt(new BigNumber(amounts[i]).multipliedBy(new BigNumber(10).pow(Number(tokenDecimals))).toFixed(0))
          );
        }

        const data = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'withdraw',
          args: [tokenAddresses, normalizedAmounts],
        });

        sendUserOperation({
          uo: {
            target: (config as any).Escrow as `0x${string}`,
            data: data as `0x${string}`,
          },
        });
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Failed to prepare withdraw';
        console.error('Error preparing withdraw:', err);
        setError(errorText);
        toast.error(errorText);
        setIsWithdrawing(false);
      }
    },
    [client, sendUserOperation, chainId]
  );

  const transactionUrl = useMemo(() => {
    if (!client?.chain?.blockExplorers || !sendUserOperationResult?.hash) {
      return undefined;
    }
    return `${client.chain.blockExplorers.default.url}/tx/${sendUserOperationResult.hash}`;
  }, [client, sendUserOperationResult?.hash]);

  return {
    isWithdrawing,
    handleWithdraw,
    transactionUrl,
    error,
  };
};
