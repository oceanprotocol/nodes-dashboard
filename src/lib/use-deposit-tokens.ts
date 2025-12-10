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

export interface DepositTokensParams {
  tokenAddress: string;
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
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string>();
  const [currentStep, setCurrentStep] = useState<'idle' | 'approving' | 'depositing'>('idle');
  const [pendingParams, setPendingParams] = useState<DepositTokensParams | null>(null);
  const chainId = CHAIN_ID;

  const { client } = useSmartAccountClient({ type: 'LightAccount' });

  const handleSuccess = () => {
    if (currentStep === 'approving' && pendingParams) {
      setCurrentStep('depositing');
      performDeposit(pendingParams.tokenAddress, pendingParams.amount);
    } else {
      setIsDepositing(false);
      setCurrentStep('idle');
      setError(undefined);
      setPendingParams(null);
      toast.success('Deposit successful!');
      onSuccess?.();
    }
  };

  const handleError = (error: Error) => {
    console.error('Deposit error:', error);
    setIsDepositing(false);
    setCurrentStep('idle');
    setError(error.message || 'Failed to deposit tokens');
    toast.error(currentStep === 'approving' ? 'Approval failed' : 'Deposit failed');
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

  const performDeposit = useCallback(
    async (tokenAddress: string, amount: string) => {
      if (!client) return;

      try {
        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          throw new Error('No escrow found for chainId');
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
        const tokenDecimals = await tokenContract.decimals();

        const normalizedAmount = new BigNumber(amount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        const data = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'deposit',
          args: [tokenAddress, BigInt(normalizedAmount)],
        });

        sendUserOperation({
          uo: {
            target: (config as any).Escrow as `0x${string}`,
            data: data as `0x${string}`,
          },
        });
      } catch (err) {
        console.error('Error preparing deposit:', err);
        setError(err instanceof Error ? err.message : 'Failed to prepare deposit');
        toast.error('Failed to prepare deposit');
        setIsDepositing(false);
        setCurrentStep('idle');
      }
    },
    [client, sendUserOperation, chainId]
  );

  const handleDeposit = useCallback(
    async ({ tokenAddress, amount }: DepositTokensParams) => {
      if (!client) {
        setError('Wallet not connected');
        toast.error('Wallet not connected');
        return;
      }

      if (!tokenAddress || !amount) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        setPendingParams({ tokenAddress, amount });

        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          setError('No escrow found for chainId');
          toast.error('No escrow found for chainId');
          return;
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(tokenAddress, ERC20Template.abi, provider);
        const tokenDecimals = await tokenContract.decimals();

        const normalizedAmount = new BigNumber(amount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        setCurrentStep('approving');
        const approveData = encodeFunctionData({
          abi: ERC20Template.abi,
          functionName: 'approve',
          args: [(config as any).Escrow, BigInt(normalizedAmount)],
        });

        sendUserOperation({
          uo: {
            target: tokenAddress as `0x${string}`,
            data: approveData as `0x${string}`,
          },
        });
      } catch (err) {
        console.error('Error preparing deposit:', err);
        setError(err instanceof Error ? err.message : 'Failed to prepare deposit');
        toast.error('Failed to prepare deposit');
        setIsDepositing(false);
        setCurrentStep('idle');
        setPendingParams(null);
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
    isDepositing,
    handleDeposit,
    transactionUrl,
    error,
  };
};
