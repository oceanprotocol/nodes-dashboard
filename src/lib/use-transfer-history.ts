import { CHAIN_ID, BASE_CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { TransferEvent } from '@/types/transfers';
import { useCallback, useEffect, useState } from 'react';

const getAlchemyBaseUrl = () => {
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) return 'https://eth-sepolia.g.alchemy.com/v2';
  if (CHAIN_ID === BASE_CHAIN_ID) return 'https://base-mainnet.g.alchemy.com/v2';
  return 'https://eth-mainnet.g.alchemy.com/v2';
};

interface AlchemyTransfer {
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  rawContract: {
    address: string | null;
    value: string | null;
    decimal: string | null;
  };
  hash: string;
  blockNum: string;
}

interface AlchemyTransfersResponse {
  result: {
    transfers: AlchemyTransfer[];
  };
}

export interface UseTransferHistoryReturn {
  transfers: TransferEvent[];
  loading: boolean;
  refetch: () => void;
}

export const useTransferHistory = (): UseTransferHistoryReturn => {
  const { account } = useOceanAccount();

  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadTransferHistory = useCallback(async () => {
    if (!account?.address) {
      setTransfers([]);
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
      const url = `${baseUrl}/${apiKey}`;

      // Fetch both sent and received transfers in parallel
      const [sentResponse, receivedResponse] = await Promise.all([
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                fromAddress: account.address,
                category: ['erc20'],
                order: 'desc',
                maxCount: '0x32', // 50
                withMetadata: false,
              },
            ],
          }),
        }),
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                toAddress: account.address,
                category: ['erc20'],
                order: 'desc',
                maxCount: '0x32', // 50
                withMetadata: false,
              },
            ],
          }),
        }),
      ]);

      const sentData: AlchemyTransfersResponse = await sentResponse.json();
      const receivedData: AlchemyTransfersResponse = await receivedResponse.json();

      const allRaw = [
        ...(sentData.result?.transfers ?? []),
        ...(receivedData.result?.transfers ?? []),
      ];

      const allTransfers: TransferEvent[] = allRaw
        .filter((t) => t.rawContract?.address)
        .map((t) => ({
          tokenSymbol: t.asset || t.rawContract.address || 'Unknown',
          tokenAddress: t.rawContract.address!,
          from: t.from,
          to: t.to,
          amount: t.value != null ? String(t.value) : '0',
          txHash: t.hash,
          blockNumber: parseInt(t.blockNum, 16),
        }));

      // Sort by block number descending
      allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);

      // Deduplicate
      const seen = new Set<string>();
      const deduplicated = allTransfers.filter((t) => {
        const key = `${t.txHash}-${t.from}-${t.to}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setTransfers(deduplicated);
    } catch (error) {
      console.error('Error loading transfer history:', error);
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  useEffect(() => {
    loadTransferHistory();
  }, [loadTransferHistory]);

  return {
    transfers,
    loading,
    refetch: loadTransferHistory,
  };
};
