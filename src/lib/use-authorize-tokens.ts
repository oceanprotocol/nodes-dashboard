import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { useSendUserOperation, useSmartAccountClient } from '@account-kit/react';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

export interface AuthorizeTokensParams {
  tokenAddress: string;
  spender: string;
  maxLockedAmount: string;
  maxLockSeconds: string;
  maxLockCount: string;
}

export interface UseAuthorizeTokensParams {
  onSuccess?: () => void;
}

export interface UseAuthorizeTokensReturn {
  isAuthorizing: boolean;
  handleAuthorize: (params: AuthorizeTokensParams) => void;
  transactionUrl?: string;
  error?: string;
}

export const useAuthorizeTokens = ({ onSuccess }: UseAuthorizeTokensParams = {}): UseAuthorizeTokensReturn => {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string>();
  const chainId = CHAIN_ID;

  const { client } = useSmartAccountClient({ type: 'LightAccount' });

  const handleSuccess = () => {
    setIsAuthorizing(false);
    setError(undefined);
    toast.success('Authorization successful!');
    onSuccess?.();
  };

  const handleError = (error: Error) => {
    console.error('Authorize error:', error);
    setIsAuthorizing(false);
    setError(error.message || 'Failed to authorize tokens');
    toast.error('Authorization failed');
  };

  const { sendUserOperationResult, sendUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
    onError: handleError,
    onSuccess: handleSuccess,
    onMutate: () => {
      setIsAuthorizing(true);
      setError(undefined);
    },
  });

  const handleAuthorize = useCallback(
    async ({ tokenAddress, spender, maxLockedAmount, maxLockSeconds, maxLockCount }: AuthorizeTokensParams) => {
      if (!client) {
        setError('Wallet not connected');
        toast.error('Wallet not connected');
        return;
      }

      if (!tokenAddress || !spender) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          setError('No escrow found for chainId');
          toast.error('No escrow found for chainId');
          return;
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
        const tokenDecimals = await tokenContract.decimals();

        const normalizedMaxLockedAmount = new BigNumber(maxLockedAmount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        const data = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'authorize',
          args: [
            tokenAddress,
            spender,
            BigInt(normalizedMaxLockedAmount),
            BigInt(maxLockSeconds),
            BigInt(maxLockCount),
          ],
        });

        sendUserOperation({
          uo: {
            target: (config as any).Escrow as `0x${string}`,
            data: data as `0x${string}`,
          },
        });
      } catch (err) {
        console.error('Error preparing authorization:', err);
        setError(err instanceof Error ? err.message : 'Failed to prepare authorization');
        toast.error('Failed to prepare authorization');
        setIsAuthorizing(false);
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
    isAuthorizing,
    handleAuthorize,
    transactionUrl,
    error,
  };
};
