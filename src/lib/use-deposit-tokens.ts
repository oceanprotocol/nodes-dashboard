import { CHAIN_ID } from '@/constants/chains';
import { getRpc } from '@/lib/constants';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
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
  const { ocean, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string>();
  const chainId = CHAIN_ID;

  const handleDeposit = useCallback(
    async ({ tokenAddress, amount }: DepositTokensParams) => {
      if (user?.type === 'eoa') {
        try {
          setIsDepositing(true);
          if (!ocean) return;
          const tx = await ocean.depositTokensEoa({ tokenAddress, amount });
          await tx.wait();
          setIsDepositing(false);
          setError(undefined);
          toast.success('Deposit successful!');
          posthog.capture('payment_deposit', { tokenAddress, amount });
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

      if (!tokenAddress || !amount) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        setIsDepositing(true);
        setError(undefined);

        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          throw new Error('No escrow found for chainId');
        }
        const escrowAddress = (config as any).Escrow as `0x${string}`;

        const tokenDecimals = await getTokenDecimals(tokenAddress);
        const normalizedAmount = new BigNumber(amount)
          .multipliedBy(new BigNumber(10).pow(Number(tokenDecimals)))
          .toFixed(0);

        const approveData = encodeFunctionData({
          abi: ERC20Template.abi,
          functionName: 'approve',
          args: [escrowAddress, BigInt(normalizedAmount)],
        });

        const depositData = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'deposit',
          args: [tokenAddress, BigInt(normalizedAmount)],
        });

        await sendTransaction([
          { to: tokenAddress as `0x${string}`, data: approveData as `0x${string}` },
          { to: escrowAddress, data: depositData as `0x${string}` },
        ]);

        setIsDepositing(false);
        setError(undefined);
        toast.success('Deposit successful!');
        posthog.capture('payment_deposit', { tokenAddress, amount });
        onSuccess?.();
      } catch (err) {
        console.error('Deposit error:', err);
        setIsDepositing(false);
        const errorText = err instanceof Error ? err.message : 'Deposit failed';
        setError(errorText);
        toast.error(errorText);
      }
    },
    [user?.type, ocean, sendTransaction, chainId, onSuccess]
  );

  return {
    isDepositing,
    handleDeposit,
    error,
  };
};
