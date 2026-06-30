import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { getEscrowEvents } from '@/services/nodeService';
import { EscrowEvent } from '@/types/payment';
import { formatDuration } from '@/utils/formatters';
import { useCallback, useEffect, useState } from 'react';

// Escrow event types the node indexes that involve the user as payer, surfaced as activity rows.
// `Claimed` is a job charge (the node consuming locked funds for a settled job). `Auth` events are
// authorization changes — created/updated/revoked, distinguished by ordering and limit values.
export type EscrowHistoryKind =
  | 'deposit'
  | 'withdraw'
  | 'lock'
  | 'release'
  | 'charge'
  | 'auth-created'
  | 'auth-updated'
  | 'auth-revoked';

export type EscrowHistoryStatus = 'confirmed' | 'pending' | 'failed';

export type EscrowHistoryEntry = {
  id: string;
  kind: EscrowHistoryKind;
  tokenSymbol: string;
  tokenAddress: string;
  // Signed human amount: positive credits the user's escrow, negative debits it.
  amount: number;
  detail: string;
  counterparty?: string;
  txHash: string;
  block: number;
  timestamp: number | null;
  status: EscrowHistoryStatus;
};

const tokenSymbolByAddress = (): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const [symbol, token] of Object.entries(getSupportedTokens())) {
    map[token.address.toLowerCase()] = symbol;
  }
  return map;
};

const tokenDecimalsByAddress = (): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const token of Object.values(getSupportedTokens())) {
    map[token.address.toLowerCase()] = token.decimals;
  }
  return map;
};

export type UseEscrowHistoryReturn = {
  entries: EscrowHistoryEntry[];
  loading: boolean;
  reload: () => void;
};

export const useEscrowHistory = (): UseEscrowHistoryReturn => {
  const { account, provider } = useOceanAccount();

  const [entries, setEntries] = useState<EscrowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!account?.address) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      // Pull every payer-scoped escrow event from the node's index in one shot, then split by type.
      // Same source as spender discovery. Note: the node only indexes base — sepolia returns nothing.
      const events = await getEscrowEvents({
        chainId: CHAIN_ID,
        payer: account.address,
        size: 500,
      });

      const symbols = tokenSymbolByAddress();
      const decimals = tokenDecimalsByAddress();

      // Auth events need cross-event context (first vs later per payee), so map them as a group.
      const authEntries = mapAuthEvents(events.filter((event) => event.eventType === 'Auth'));
      const otherEntries = events
        .filter((event) => event.eventType !== 'Auth')
        .map((event) => toEntry(event, symbols, decimals))
        .filter((entry): entry is EscrowHistoryEntry => entry !== null);

      const mapped = [...otherEntries, ...authEntries];

      const withTimestamps = await resolveTimestamps(mapped, provider);
      // Newest first. Fall back to block number when a timestamp is missing.
      withTimestamps.sort((a, b) => (b.timestamp ?? b.block) - (a.timestamp ?? a.block));
      setEntries(withTimestamps);
    } catch (err) {
      console.error('Failed to load escrow history:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [account?.address, provider]);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, reload: load };
};

const toEntry = (
  event: EscrowEvent,
  symbols: Record<string, string>,
  decimals: Record<string, number>
): EscrowHistoryEntry | null => {
  const tokenAddress = event.token ?? '';
  const tokenKey = tokenAddress.toLowerCase();
  const tokenSymbol = symbols[tokenKey] ?? '';
  // Only the dashboard's supported tokens get a symbol; skip anything else.
  if (!tokenSymbol) {
    return null;
  }
  const tokenDecimals = decimals[tokenKey] ?? 6;
  const rawAmount = Number(event.amount ?? '0') / Math.pow(10, tokenDecimals);

  const base = {
    id: event.id,
    tokenSymbol,
    tokenAddress,
    txHash: event.txHash,
    block: event.block,
    timestamp: null,
    status: 'confirmed' as EscrowHistoryStatus,
  };

  switch (event.eventType) {
    case 'Deposit': {
      return { ...base, kind: 'deposit', amount: rawAmount, detail: 'Deposit to escrow' };
    }
    case 'Withdraw': {
      return { ...base, kind: 'withdraw', amount: -rawAmount, detail: 'Withdraw from escrow' };
    }
    case 'Lock': {
      return {
        ...base,
        kind: 'lock',
        amount: rawAmount,
        detail: 'Funds locked for compute job',
        counterparty: event.payee,
      };
    }
    case 'Canceled': {
      return {
        ...base,
        kind: 'release',
        amount: rawAmount,
        detail: 'Lock released',
        counterparty: event.payee,
      };
    }
    case 'Claimed': {
      return {
        ...base,
        kind: 'charge',
        amount: -rawAmount,
        detail: 'Job charge settled',
        counterparty: event.payee,
      };
    }
    default: {
      return null;
    }
  }
};

// Auth events carry no token field, so amounts use the default 6 decimals shared by supported tokens.
const AUTH_DECIMALS = 6;

const isRevokedAuth = (event: EscrowEvent): boolean =>
  Number(event.maxLockedAmount ?? '0') === 0 &&
  Number(event.maxLockSeconds ?? '0') === 0 &&
  Number(event.maxLockCounts ?? '0') === 0;

// Map `Auth` events to created/updated/revoked rows. The chain emits identical events for every
// authorization change, so "created" is just the first event per payee; later ones are updates.
// A revoke is an Auth with all limits zeroed. Events have no token, so rows show no token symbol.
const mapAuthEvents = (authEvents: EscrowEvent[]): EscrowHistoryEntry[] => {
  // Process oldest-first so the first event per payee is the creation.
  const chronological = [...authEvents].sort((a, b) => a.block - b.block);
  const seenPayees = new Set<string>();

  return chronological.map((event) => {
    const payeeKey = (event.payee ?? '').toLowerCase();
    const isFirst = !seenPayees.has(payeeKey);
    seenPayees.add(payeeKey);

    const revoked = isRevokedAuth(event);
    const kind: EscrowHistoryKind = revoked ? 'auth-revoked' : isFirst ? 'auth-created' : 'auth-updated';

    const maxLocked = Number(event.maxLockedAmount ?? '0') / Math.pow(10, AUTH_DECIMALS);
    const detail = revoked
      ? 'Authorization revoked'
      : `Max ${event.maxLockCounts ?? '0'} locks · ${formatDuration(Number(event.maxLockSeconds ?? '0'), true)}`;

    return {
      id: event.id,
      kind,
      tokenSymbol: '',
      tokenAddress: '',
      // Max locked amount the spender may hold (token unknown — Auth events carry none).
      amount: maxLocked,
      detail,
      counterparty: event.payee,
      txHash: event.txHash,
      block: event.block,
      timestamp: null,
      status: 'confirmed' as EscrowHistoryStatus,
    };
  });
};

// Events carry only a block number, so resolve timestamps by fetching each unique block once.
const resolveTimestamps = async (
  entries: EscrowHistoryEntry[],
  provider: ReturnType<typeof useOceanAccount>['provider']
): Promise<EscrowHistoryEntry[]> => {
  if (!provider) {
    return entries;
  }
  const uniqueBlocks = Array.from(new Set(entries.map((entry) => entry.block)));
  const timestampByBlock = new Map<number, number>();
  await Promise.all(
    uniqueBlocks.map(async (block) => {
      try {
        const data = await provider.getBlock(block);
        if (data?.timestamp) {
          timestampByBlock.set(block, data.timestamp);
        }
      } catch (err) {
        console.warn(`Failed to resolve timestamp for block ${block}:`, err);
      }
    })
  );
  return entries.map((entry) => ({ ...entry, timestamp: timestampByBlock.get(entry.block) ?? null }));
};
