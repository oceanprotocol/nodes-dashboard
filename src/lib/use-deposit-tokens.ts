import { CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSendUserOperation } from '@account-kit/react';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import posthog from 'posthog-js';
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
  const { client, ocean, user } = useOceanAccount();

  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string>();
  const [currentStep, setCurrentStep] = useState<'idle' | 'approving' | 'depositing'>('idle');
  const [pendingParams, setPendingParams] = useState<DepositTokensParams | null>(null);
  const chainId = CHAIN_ID;

  const handleSuccess = () => {
    if (currentStep === 'approving' && pendingParams && user?.type !== 'eoa') {
      setCurrentStep('depositing');
      performDeposit(pendingParams.tokenAddress, pendingParams.amount);
    } else {
      setIsDepositing(false);
      setCurrentStep('idle');
      setError(undefined);
      setPendingParams(null);
      toast.success('Deposit successful!');
      posthog.capture('payment_deposit', {
        tokenAddress: pendingParams?.tokenAddress,
        amount: pendingParams?.amount,
      });
      onSuccess?.();
    }
  };

  const handleError = (error: any) => {
    console.error('Deposit error:', error);
    setIsDepositing(false);
    setCurrentStep('idle');
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
    const errorText =
      prettyErr ?? error.details ?? (currentStep === 'approving' ? 'Approval failed' : 'Deposit failed');
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
        const errorText = err instanceof Error ? err.message : 'Failed to prepare deposit';
        setError(errorText);
        toast.error(errorText);
        setIsDepositing(false);
        setCurrentStep('idle');
      }
    },
    [client, sendUserOperation, chainId]
  );

  const handleDeposit = useCallback(
    async ({ tokenAddress, amount }: DepositTokensParams) => {
      if (user?.type === 'eoa') {
        try {
          setIsDepositing(true);
          if (!ocean) {
            return;
          }
          const tx = await ocean.depositTokensEoa({ tokenAddress, amount });
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
        const errorText = err instanceof Error ? err.message : 'Failed to prepare deposit';
        setError(errorText);
        toast.error(errorText);
        setIsDepositing(false);
        setCurrentStep('idle');
        setPendingParams(null);
      }
    },
    [user?.type, client, ocean, sendUserOperation, chainId]
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
