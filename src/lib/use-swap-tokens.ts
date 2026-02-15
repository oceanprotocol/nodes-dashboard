import CompySwap from '@/constants/abis/compy-swap.json';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { RPC_URL } from '@/lib/constants';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSendUserOperation } from '@account-kit/react';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

export interface SwapTokensParams {
  amount: string; // Amount in human readable format (e.g. "10")
}

export interface UseSwapTokensParams {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export interface UseSwapTokensReturn {
  isSwapping: boolean;
  handleSwap: (params: SwapTokensParams) => Promise<void>;
  transactionUrl?: string;
  error?: string;
}

export const useSwapTokens = ({ onSuccess, onError }: UseSwapTokensParams = {}): UseSwapTokensReturn => {
  const { client, user, account } = useOceanAccount();

  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string>();

  const handleSuccess = useCallback(() => {
    setIsSwapping(false);
    setError(undefined);
    toast.success('Swap successful!');
    onSuccess?.();
  }, [onSuccess]);

  const handleError = useCallback(
    (error: unknown) => {
      console.error('Swap error:', error);
      setIsSwapping(false);
      const message = error instanceof Error ? error.message : 'Swap failed';
      setError(message);
      toast.error('Swap failed');
      onError?.(error);
    },
    [onError]
  );

  const { sendUserOperationResult, sendUserOperation } = useSendUserOperation({
    client,
    waitForTxn: true,
    onError: handleError,
    onSuccess: handleSuccess,
    onMutate: () => {
      setIsSwapping(true);
      setError(undefined);
    },
  });

  const handleSwap = useCallback(
    async ({ amount }: SwapTokensParams) => {
      if (!amount || Number(amount) <= 0) {
        handleError(new Error('Invalid amount'));
        return;
      }

      const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === CHAIN_ID);
      const compySwapAddress = (config as any)?.COMPYSwap;
      if (!compySwapAddress) {
        throw new Error('No swap address found for chainId');
      }

      const usdcAddress = getSupportedTokens().USDC;
      if (!usdcAddress) {
        handleError(new Error('USDC token address not found'));
        return;
      }

      try {
        setIsSwapping(true);
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const usdcContract = new ethers.Contract(usdcAddress, ERC20Template.abi, provider);
        const usdcDecimals = await usdcContract.decimals();
        const amountBigInt = ethers.parseUnits(amount, Number(usdcDecimals));

        // EOA Handling
        if (user?.type === 'eoa') {
          if (!(window as any).ethereum) {
            throw new Error('No crypto wallet found');
          }
          const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
          const signer = await browserProvider.getSigner();

          const usdcWithSigner = new ethers.Contract(usdcAddress, ERC20Template.abi, signer);
          const compySwapWithSigner = new ethers.Contract(compySwapAddress, CompySwap, signer);

          const allowance = await usdcWithSigner.allowance(await signer.getAddress(), compySwapAddress);
          if (allowance < amountBigInt) {
            const approveTx = await usdcWithSigner.approve(compySwapAddress, amountBigInt);
            await approveTx.wait();
            toast.info('Approval successful. Proceeding to swap...');
          }

          const swapTx = await compySwapWithSigner.swapToCOMPY(amountBigInt);
          await swapTx.wait();
          handleSuccess();
          return;
        }

        // SCA Handling
        if (!client) {
          throw new Error('Wallet not connected');
        }

        const uos = [];

        if (!account.address) {
          throw new Error('Account address not found');
        }

        const currentAllowance = await usdcContract.allowance(account.address, compySwapAddress);

        if (currentAllowance < amountBigInt) {
          const approveData = encodeFunctionData({
            abi: ERC20Template.abi,
            functionName: 'approve',
            args: [compySwapAddress, amountBigInt],
          });
          uos.push({
            target: usdcAddress as `0x${string}`,
            data: approveData as `0x${string}`,
          });
        }

        const swapData = encodeFunctionData({
          abi: CompySwap,
          functionName: 'swapToCOMPY',
          args: [amountBigInt],
        });
        uos.push({
          target: compySwapAddress as `0x${string}`,
          data: swapData as `0x${string}`,
        });

        if (uos.length === 1) {
          sendUserOperation({ uo: uos[0] });
        } else {
          sendUserOperation({ uo: uos });
        }
      } catch (error) {
        handleError(error);
      }
    },
    [client, user?.type, account.address, sendUserOperation, handleError, handleSuccess]
  );

  const transactionUrl = useMemo(() => {
    if (!client?.chain?.blockExplorers || !sendUserOperationResult?.hash) {
      return undefined;
    }
    return `${client.chain.blockExplorers.default.url}/tx/${sendUserOperationResult.hash}`;
  }, [client, sendUserOperationResult?.hash]);

  return {
    isSwapping,
    handleSwap,
    transactionUrl,
    error,
  };
};
