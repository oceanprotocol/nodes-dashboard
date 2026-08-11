import { getDisplayTokens } from '@/constants/tokens';
import { alchemyClient } from '@/lib/alchemy-client';
import { OceanProvider } from '@/lib/ocean-provider';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export interface UseWalletBalancesReturn {
  balances: NodeBalance[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useWalletBalances = (): UseWalletBalancesReturn => {
  const { account, ocean } = useOceanAccount();

  const [balances, setBalances] = useState<NodeBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadBalances = useCallback(async () => {
    if (!ocean || !account?.address) {
      setBalances([]);
      return;
    }

    setLoading(true);
    try {
      const displayTokens = Object.entries(getDisplayTokens());
      const erc20Addresses = displayTokens.filter(([, token]) => !token.isNative).map(([, token]) => token.address);

      const [nativeBalance, erc20Data] = await Promise.all([
        alchemyClient.core.getBalance(account.address),
        erc20Addresses.length > 0
          ? alchemyClient.core.getTokenBalances(account.address, erc20Addresses)
          : Promise.resolve({ tokenBalances: [] }),
      ]);

      const erc20ByAddress = new Map(
        (erc20Data.tokenBalances ?? []).map((tb) => [tb.contractAddress.toLowerCase(), tb.tokenBalance])
      );

      const walletBalances: NodeBalance[] = displayTokens.map(([symbol, token]) => {
        const rawBalance = token.isNative
          ? nativeBalance.toString()
          : (erc20ByAddress.get(token.address.toLowerCase()) ?? '0x0');
        const amount = Number(OceanProvider.denominateNumber(BigInt(rawBalance).toString(), token.decimals));

        return {
          token: symbol,
          address: token.address,
          amount,
          isNative: token.isNative,
        };
      });

      setBalances(walletBalances);
    } catch (error) {
      toast.error('Error loading wallet balances');
      console.error('Error loading wallet balances:', error);
    } finally {
      setLoading(false);
    }
  }, [ocean, account?.address]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  return {
    balances,
    loading,
    refetch: loadBalances,
  };
};
