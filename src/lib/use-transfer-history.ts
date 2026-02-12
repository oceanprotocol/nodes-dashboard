import { alchemyClient } from '@/lib/alchemy-client';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { TransferEvent } from '@/types/transfers';
import { AssetTransfersCategory, SortingOrder } from 'alchemy-sdk';
import { useCallback, useEffect, useState } from 'react';

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

    setLoading(true);
    try {
      // Fetch both sent and received transfers in parallel
      const [sentData, receivedData] = await Promise.all([
        alchemyClient.core.getAssetTransfers({
          fromAddress: account.address,
          category: [AssetTransfersCategory.ERC20],
          order: SortingOrder.DESCENDING,
          maxCount: 50,
          withMetadata: false,
        }),
        alchemyClient.core.getAssetTransfers({
          toAddress: account.address,
          category: [AssetTransfersCategory.ERC20],
          order: SortingOrder.DESCENDING,
          maxCount: 50,
          withMetadata: false,
        }),
      ]);

      const allRaw = [...(sentData.transfers ?? []), ...(receivedData.transfers ?? [])];

      const allTransfers: TransferEvent[] = allRaw
        .filter((t) => t.rawContract?.address)
        .map((t) => ({
          tokenSymbol: t.asset || t.rawContract.address || 'Unknown',
          tokenAddress: t.rawContract.address!,
          from: t.from,
          to: t.to!,
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
