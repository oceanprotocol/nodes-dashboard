import { CHAIN_ID } from '@/constants/chains';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@account-kit/privy-integration';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import BigNumber from 'bignumber.js';
import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
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
  const { ocean, user } = useOceanAccount();
  const { sendTransaction } = useAlchemySendTransaction();

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string>();
  const [transactionUrl, setTransactionUrl] = useState<string | undefined>(undefined);
  const chainId = CHAIN_ID;

  const handleAuthorize = useCallback(
    async ({ tokenAddress, spender, maxLockedAmount, maxLockSeconds, maxLockCount }: AuthorizeTokensParams) => {
      if (user?.type === 'eoa') {
        try {
          setIsAuthorizing(true);
          if (!ocean) return;
          const tx = await ocean.authorizeTokensEoa({
            tokenAddress,
            spender,
            maxLockedAmount,
            maxLockSeconds,
            maxLockCount,
          });
          await tx.wait();
          toast.success('Authorization successful!');
          posthog.capture('payment_authorize');
          onSuccess?.();
        } catch (err) {
          console.error('Authorize error:', err);
          setError(err instanceof Error ? err.message : 'Failed to authorize tokens');
          toast.error('Authorization failed');
        } finally {
          setIsAuthorizing(false);
        }
        return;
      }

      if (!tokenAddress || !spender) {
        setError('Missing required parameters');
        toast.error('Missing required parameters');
        return;
      }

      try {
        setIsAuthorizing(true);
        setError(undefined);

        const config = Object.values(Address).find((chainConfig: any) => chainConfig.chainId === chainId);
        if (!config || !(config as any).Escrow) {
          throw new Error('No escrow found for chainId');
        }

        const tokenDecimals = await getTokenDecimals(tokenAddress);
        const normalizedMaxLockedAmount = BigInt(
          new BigNumber(maxLockedAmount).multipliedBy(new BigNumber(10).pow(Number(tokenDecimals))).toFixed(0)
        );

        const data = encodeFunctionData({
          abi: Escrow.abi,
          functionName: 'authorize',
          args: [tokenAddress, spender, normalizedMaxLockedAmount, BigInt(maxLockSeconds), BigInt(maxLockCount)],
        });

        const result = await sendTransaction({
          to: (config as any).Escrow as `0x${string}`,
          data: data as `0x${string}`,
        });

        const explorerBase =
          process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'https://basescan.org' : 'https://sepolia.etherscan.io';
        setTransactionUrl(`${explorerBase}/tx/${result.txnHash}`);

        toast.success('Authorization successful!');
        posthog.capture('payment_authorize');
        onSuccess?.();
      } catch (err) {
        console.error('Authorize error:', err);
        setError(err instanceof Error ? err.message : 'Failed to authorize tokens');
        toast.error('Authorization failed');
      } finally {
        setIsAuthorizing(false);
      }
    },
    [user?.type, ocean, sendTransaction, onSuccess, chainId]
  );

  return {
    isAuthorizing,
    handleAuthorize,
    transactionUrl,
    error,
  };
};
