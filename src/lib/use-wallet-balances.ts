import { alchemyClient } from '@/lib/alchemy-client';
import { OceanProvider } from '@/lib/ocean-provider';
import { getTokenDecimals, getTokenSymbol } from '@/lib/token-symbol';
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
      const data = await alchemyClient.core.getTokenBalances(account.address);
      const tokenBalances = data.tokenBalances ?? [];

      // Filter out zero balances
      const nonZeroBalances = tokenBalances.filter(
        (tb) =>
          tb.tokenBalance &&
          tb.tokenBalance !== '0x' &&
          tb.tokenBalance !== '0x0' &&
          tb.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      );

      const walletBalances: NodeBalance[] = await Promise.all(
        nonZeroBalances.map(async (tb) => {
          const symbol = await getTokenSymbol(tb.contractAddress);
          const decimals = await getTokenDecimals(tb.contractAddress);
          const amount = Number(OceanProvider.denominateNumber(BigInt(tb.tokenBalance!).toString(), decimals));
          return {
            token: symbol || tb.contractAddress,
            address: tb.contractAddress,
            amount,
          };
        })
      );

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
