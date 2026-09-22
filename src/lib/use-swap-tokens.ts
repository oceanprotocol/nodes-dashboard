import { getGrantsSwap } from '@/lib/grants-swap';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { useOceanAccount } from '@/lib/use-ocean-account';
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
  const { user, account, provider } = useOceanAccount();
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

      try {
        setIsSwapping(true);
        setError(undefined);

        if (!provider) {
          throw new Error('No crypto wallet found');
        }

        if (user?.type === 'eoa') {
          // The connected wallet's provider: with EIP-6963 that is not necessarily
          // whichever extension won window.ethereum.
          const signer = await provider.getSigner();
          const grantsSwap = getGrantsSwap(signer);

          // Which token the swap takes comes from the contract, not from a local address table.
          const inputToken = await grantsSwap.getInputToken();
          const amountBigInt = ethers.parseUnits(amount, await getTokenDecimals(inputToken));

          const inputTokenWithSigner = new ethers.Contract(inputToken, ERC20Template.abi, signer);
          const allowance = await inputTokenWithSigner.allowance(await signer.getAddress(), grantsSwap.address);
          if (allowance < amountBigInt) {
            const approveTx = await inputTokenWithSigner.approve(grantsSwap.address, amountBigInt);
            await approveTx.wait();
            toast.info('Approval successful. Proceeding to swap...');
          }

          // ocean.js catches send failures and resolves to null instead of throwing, so a rejected
          // signature would otherwise fall through to the success path below.
          const receipt = await grantsSwap.swapToCOMPY(amount);
          if (!receipt) {
            throw new Error('Swap transaction failed');
          }

          setIsSwapping(false);
          setError(undefined);
          toast.success('Swap successful!');
          onSuccess?.();
          return;
        }

        if (!account.address) {
          throw new Error('Account address not found');
        }

        // Already the RPC provider on the SCA path — there is no ethers signer here, so the wrapper
        // gets a VoidSigner. That covers the reads and the ABI; the send stays on the Alchemy batch.
        const grantsSwap = getGrantsSwap(new ethers.VoidSigner(account.address, provider));
        const inputToken = await grantsSwap.getInputToken();
        const amountBigInt = ethers.parseUnits(amount, await getTokenDecimals(inputToken));

        const inputTokenContract = new ethers.Contract(inputToken, ERC20Template.abi, provider);
        const currentAllowance = await inputTokenContract.allowance(account.address, grantsSwap.address);

        const uos: { to: `0x${string}`; data: `0x${string}` }[] = [];

        if (currentAllowance < amountBigInt) {
          const approveData = encodeFunctionData({
            abi: ERC20Template.abi,
            functionName: 'approve',
            args: [grantsSwap.address, amountBigInt],
          });
          uos.push({ to: inputToken as `0x${string}`, data: approveData as `0x${string}` });
        }

        // Not `swapToCOMPYTx()`: it estimates gas up front, which reverts while the approve batched
        // alongside it has not landed yet. Encoding off the wrapper's own ABI keeps the single UserOp.
        const swapData = grantsSwap.contract.interface.encodeFunctionData('swapToCOMPY', [amountBigInt]);
        uos.push({ to: grantsSwap.address as `0x${string}`, data: swapData as `0x${string}` });

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
    [user?.type, account.address, provider, sendTransaction, onSuccess, onError]
  );

  return {
    isSwapping,
    handleSwap,
    error,
  };
};
