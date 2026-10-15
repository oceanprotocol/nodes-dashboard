import {
  EscrowJobRef,
  EscrowLockCycle,
  EscrowToken,
  getEscrowToken,
  groupLockCycles,
  TimedEscrowEvent,
  toTokenAmount,
} from '@/lib/escrow-events';
import { usePayerEscrowEvents } from '@/lib/use-escrow-events';
import { formatDuration, formatTokenAmount } from '@/utils/formatters';
import dayjs from 'dayjs';
import { useMemo } from 'react';

export type EscrowHistoryKind =
  | 'deposit'
  | 'withdraw'
  | 'auth-created'
  | 'auth-updated'
  | 'auth-revoked'
  | 'lock'
  | 'relock'
  | 'claim'
  | 'cancel'
  | 'subsidy-lock'
  | 'subsidy-refund'
  | 'subsidy-claim';

export type EscrowHistoryEntry = {
  /** Token units. For authorizations, the max locked amount. */
  amount: number | null;
  block: number;
  detail: string;
  /** Set only where the row moves the payer's escrow balance one way. */
  direction: 'in' | 'out' | null;
  id: string;
  job: EscrowJobRef | null;
  kind: EscrowHistoryKind;
  payee: string | null;
  timestamp: number | null;
  /** `null` only on authorizations indexed by nodes that predate the token field. */
  token: EscrowToken | null;
  txHash: string;
};

const isRevokedAuth = (event: TimedEscrowEvent) =>
  [event.maxLockedAmount, event.maxLockSeconds, event.maxLockCounts].every((value) => Number(value ?? '0') === 0);

const describeAuth = (event: TimedEscrowEvent) => {
  const limits = `Up to ${event.maxLockCounts ?? '0'} locks of ${formatDuration(Number(event.maxLockSeconds ?? '0'), true)}`;
  const expiry = Number(event.expiryTimestamp ?? '0');
  return expiry > 0 ? `${limits} · expires ${dayjs.unix(expiry).format('MMM D, YYYY')}` : limits;
};

const formatAmount = (amount: number, token: EscrowToken) =>
  `${formatTokenAmount(amount, token.address)} ${token.symbol}`;

/** Newest first. */
export const buildEscrowHistory = (events: TimedEscrowEvent[]): EscrowHistoryEntry[] => {
  const cycleByEvent = new Map<string, EscrowLockCycle>();
  for (const cycle of groupLockCycles(events)) {
    for (const event of cycle.events) {
      cycleByEvent.set(event.id, cycle);
    }
  }
  const authorizedPayees = new Set<string>();
  const entries: EscrowHistoryEntry[] = [];

  for (const event of events) {
    const token = getEscrowToken(event.token);
    if (event.token && !token) {
      continue;
    }
    const cycle = cycleByEvent.get(event.id);
    const amountOf = (raw: string | undefined) => (token ? toTokenAmount(raw, token) : null);
    const base = {
      block: event.block,
      direction: null,
      id: event.id,
      job: cycle?.job ?? null,
      payee: event.payee ?? null,
      timestamp: event.timestamp,
      token,
      txHash: event.txHash,
    };

    switch (event.eventType) {
      case 'Deposit':
        entries.push({
          ...base,
          amount: amountOf(event.amount),
          detail: 'Deposited to escrow',
          direction: 'in',
          kind: 'deposit',
        });
        break;
      case 'Withdraw':
        entries.push({
          ...base,
          amount: amountOf(event.amount),
          detail: 'Withdrawn from escrow',
          direction: 'out',
          kind: 'withdraw',
        });
        break;
      case 'Auth': {
        const key = `${event.payee}-${event.token ?? ''}`;
        const isFirst = !authorizedPayees.has(key);
        authorizedPayees.add(key);
        if (isRevokedAuth(event)) {
          entries.push({ ...base, amount: null, detail: 'Authorization revoked', kind: 'auth-revoked' });
          break;
        }
        entries.push({
          ...base,
          amount: amountOf(event.maxLockedAmount),
          detail: describeAuth(event),
          kind: isFirst ? 'auth-created' : 'auth-updated',
        });
        break;
      }
      case 'Lock':
        entries.push({ ...base, amount: amountOf(event.amount), detail: 'Funds locked for a job', kind: 'lock' });
        break;
      case 'ReLock':
        entries.push({
          ...base,
          amount: amountOf(event.newAmount),
          detail: token
            ? `Lock changed from ${formatAmount(toTokenAmount(event.oldAmount, token), token)}`
            : 'Lock changed',
          kind: 'relock',
        });
        break;
      case 'Claimed': {
        const cost = amountOf(event.amount);
        const sponsored = cycle?.sponsored ?? 0;
        entries.push({
          ...base,
          amount: cost === null ? null : Math.max(0, cost - sponsored),
          detail:
            token && cost !== null && sponsored > 0
              ? `Job cost ${formatAmount(cost, token)}, ${formatAmount(sponsored, token)} paid by the subsidy`
              : 'Job charged',
          direction: 'out',
          kind: 'claim',
        });
        break;
      }
      case 'Canceled':
        entries.push({
          ...base,
          amount: amountOf(event.amount),
          detail: 'Lock released, unused funds returned',
          kind: 'cancel',
        });
        break;
      case 'LockSponsored':
        entries.push({
          ...base,
          amount: amountOf(event.amount),
          detail: 'Paid up front by the subsidy',
          kind: 'subsidy-lock',
        });
        break;
      case 'SponsorRefunded':
        entries.push({
          ...base,
          amount: amountOf(event.amount),
          detail: 'Unused subsidy returned to the program',
          kind: 'subsidy-refund',
        });
        break;
      case 'Subsidized':
        entries.push({
          ...base,
          amount: amountOf(event.subsidyAmount),
          detail: 'Subsidy credited to escrow',
          direction: 'in',
          kind: 'subsidy-claim',
        });
        break;
    }
  }

  return entries.reverse();
};

export const useEscrowHistory = () => {
  const { data: events, isError, isFetching, isLoading, refetch } = usePayerEscrowEvents();
  const entries = useMemo(() => (events ? buildEscrowHistory(events) : []), [events]);

  return { entries, isError, isFetching, isLoading, refetch };
};
