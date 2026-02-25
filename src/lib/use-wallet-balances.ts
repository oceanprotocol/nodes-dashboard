import { alchemyClient } from '@/lib/alchemy-client';
import { RPC_URL } from '@/lib/constants';
import { OceanProvider } from '@/lib/ocean-provider';
import { getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
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

      const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { batchMaxCount: 3 });

      const walletBalances: NodeBalance[] = await Promise.all(
        nonZeroBalances.map(async (tb) => {
          const symbol = await getTokenSymbol(tb.contractAddress);
          const tokenContract = new ethers.Contract(tb.contractAddress, ERC20Template.abi, provider);
          const decimals = await tokenContract.decimals();
          const amount = Number(OceanProvider.denominateNumber(BigInt(tb.tokenBalance!).toString(), Number(decimals)));
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
