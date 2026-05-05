import CompySwap from '@/constants/abis/compy-swap.json';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useCallback, useState } from 'react';
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
  const { user, account } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string>();

  const handleSwap = useCallback(
    async ({ amount }: SwapTokensParams) => {
      if (!amount || Number(amount) <= 0) {
        const message = 'Invalid amount';
        setError(message);
        toast.error(message);
        onError?.(new Error(message));
        return;
      }

      const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === CHAIN_ID);
      const compySwapAddress = (config as any)?.COMPYSwap;
      if (!compySwapAddress) {
        const message = 'No swap address found for chainId';
        setError(message);
        toast.error(message);
        onError?.(new Error(message));
        return;
      }

      const usdcAddress = getSupportedTokens().USDC.address;
      if (!usdcAddress) {
        const message = 'USDC token address not found';
        setError(message);
        toast.error(message);
        onError?.(new Error(message));
        return;
      }

      try {
        setIsSwapping(true);
        setError(undefined);

        const usdcDecimals = await getTokenDecimals(usdcAddress);
        const amountBigInt = ethers.parseUnits(amount, Number(usdcDecimals));

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
          setIsSwapping(false);
          setError(undefined);
          toast.success('Swap successful!');
          onSuccess?.();
          return;
        }

        if (!account.address) {
          throw new Error('Account address not found');
        }

        const provider = new ethers.JsonRpcProvider((await import('@/lib/constants')).getRpc());
        const usdcContract = new ethers.Contract(usdcAddress, ERC20Template.abi, provider);
        const currentAllowance = await usdcContract.allowance(account.address, compySwapAddress);

        const uos: { to: `0x${string}`; data: `0x${string}` }[] = [];

        if (currentAllowance < amountBigInt) {
          const approveData = encodeFunctionData({
            abi: ERC20Template.abi,
            functionName: 'approve',
            args: [compySwapAddress, amountBigInt],
          });
          uos.push({ to: usdcAddress as `0x${string}`, data: approveData as `0x${string}` });
        }

        const swapData = encodeFunctionData({
          abi: CompySwap,
          functionName: 'swapToCOMPY',
          args: [amountBigInt],
        });
        uos.push({ to: compySwapAddress as `0x${string}`, data: swapData as `0x${string}` });

        await sendTransaction(uos.length === 1 ? uos[0] : uos);

        setIsSwapping(false);
        setError(undefined);
        toast.success('Swap successful!');
        onSuccess?.();
      } catch (err) {
        console.error('Swap error:', err);
        setIsSwapping(false);
        const message = err instanceof Error ? err.message : 'Swap failed';
        setError(message);
        toast.error('Swap failed');
        onError?.(err);
      }
    },
    [user?.type, account.address, sendTransaction, onSuccess, onError]
  );

  return {
    isSwapping,
    handleSwap,
    error,
  };
};
