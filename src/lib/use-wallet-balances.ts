import { CHAIN_ID, BASE_CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { RPC_URL } from '@/lib/constants';
import { getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import { OceanProvider } from '@/lib/ocean-provider';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20Template.sol/ERC20Template.json';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export interface UseWalletBalancesReturn {
  balances: NodeBalance[];
  loading: boolean;
  refetch: () => void;
}

const getAlchemyBaseUrl = () => {
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) return 'https://eth-sepolia.g.alchemy.com/v2';
  if (CHAIN_ID === BASE_CHAIN_ID) return 'https://base-mainnet.g.alchemy.com/v2';
  return 'https://eth-mainnet.g.alchemy.com/v2';
};

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface AlchemyTokenBalancesResponse {
  result: {
    address: string;
    tokenBalances: AlchemyTokenBalance[];
  };
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

    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error('Alchemy API key not configured');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = getAlchemyBaseUrl();
      const response = await fetch(`${baseUrl}/${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenBalances',
          params: [account.address, 'erc20'],
        }),
      });

      const data: AlchemyTokenBalancesResponse = await response.json();
      const tokenBalances = data.result?.tokenBalances ?? [];

      // Filter out zero balances and resolve symbols
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
          const amount = Number(
            OceanProvider.denominateNumber(BigInt(tb.tokenBalance).toString(), Number(decimals))
          );
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
