import { CHAIN_ID } from '@/constants/chains';
import { getTokenDecimals } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAlchemySendTransaction } from '@/lib/use-alchemy-client';
import { formatWalletAddress } from '@/utils/formatters';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import Escrow from '@oceanprotocol/contracts/artifacts/contracts/escrow/Escrow.sol/Escrow.json';
import BigNumber from 'bignumber.js';
import posthog from 'posthog-js';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';

const authorizationSuccessMessage = (consumerAddress: string, peerId?: string) => {
  const target = peerId
    ? `node ${formatWalletAddress(peerId)} (consumer ${formatWalletAddress(consumerAddress)})`
    : `consumer ${formatWalletAddress(consumerAddress)}`;
  return `Authorization successful for ${target}. It will appear in the authorizations list in a short while.`;
};

export interface AuthorizeTokensParams {
  tokenAddress: string;
  peerId?: string;
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
  const chainId = CHAIN_ID;

  const handleAuthorize = useCallback(
    async ({ tokenAddress, peerId, spender, maxLockedAmount, maxLockSeconds, maxLockCount }: AuthorizeTokensParams) => {
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
          setIsAuthorizing(false);
          setError(undefined);
          toast.success(authorizationSuccessMessage(spender, peerId));
          posthog.capture('payment_authorize');
          onSuccess?.();
        } catch (err) {
          console.error('Authorize error:', err);
          setIsAuthorizing(false);
          const errorText = err instanceof Error ? err.message : 'Authorization failed';
          setError(errorText);
          toast.error('Authorization failed');
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

        await sendTransaction({
          to: (config as any).Escrow as `0x${string}`,
          data: data as `0x${string}`,
        });

        setIsAuthorizing(false);
        setError(undefined);
        toast.success(authorizationSuccessMessage(spender, peerId));
        posthog.capture('payment_authorize');
        onSuccess?.();
      } catch (err) {
        console.error('Authorize error:', err);
        setIsAuthorizing(false);
        setError(err instanceof Error ? err.message : 'Failed to prepare authorization');
        toast.error('Authorization failed');
      }
    },
    [user?.type, ocean, sendTransaction, chainId, onSuccess]
  );

  return {
    isAuthorizing,
    handleAuthorize,
    error,
  };
};
