import { CHAIN_ID } from '@/constants/chains';
import { isUsdc, USDC } from '@/constants/tokens';
import { getRpc } from '@/lib/constants';
import { getEscrowEvents } from '@/services/nodeService';
import { EscrowEventRecord } from '@oceanprotocol/lib';
import { ethers } from 'ethers';

export type TimedEscrowEvent = EscrowEventRecord & {
  logIndex: number;
  /** Unix seconds, `null` when the block could not be read. */
  timestamp: number | null;
};

export type EscrowJobKind = 'compute' | 'service';

export type EscrowJobRef = {
  id: string;
  kind: EscrowJobKind;
};

export type EscrowToken = {
  address: string;
  decimals: number;
  symbol: string;
};

export type EscrowLockStatus = 'locked' | 'claimed' | 'canceled';

/** One lock from creation to claim or cancel. A service reuses its jobId for every extension. */
export type EscrowLockCycle = {
  /** Charged amount: claimed amount, the locked amount while still locked, 0 once canceled. */
  cost: number;
  events: TimedEscrowEvent[];
  id: string;
  /** Decoded from the claim proof, so only known once claimed. */
  job: EscrowJobRef | null;
  jobId: string;
  payee: string;
  status: EscrowLockStatus;
  /** Lock-time sponsorship minus refunds, in token units. Covers part of the cost instead of the payer's escrow. */
  sponsored: number;
  /** Net raw amount per subsidy provider: lock-time sponsorship minus refunds, plus claim-time subsidy. */
  subsidyByProvider: Map<string, bigint>;
  timestamp: number | null;
  token: EscrowToken;
};

const BLOCK_FETCH_CHUNK_SIZE = 50;

const blockTimestamps = new Map<number, number>();

const loadBlockTimestamps = async (blocks: number[]) => {
  const missing = [...new Set(blocks)].filter((block) => !blockTimestamps.has(block));
  if (missing.length === 0) {
    return;
  }
  const rpc = new ethers.JsonRpcProvider(getRpc());
  for (let i = 0; i < missing.length; i += BLOCK_FETCH_CHUNK_SIZE) {
    const chunk = missing.slice(i, i + BLOCK_FETCH_CHUNK_SIZE);
    const results = await Promise.all(chunk.map((block) => rpc.getBlock(block).catch(() => null)));
    for (const result of results) {
      if (result) {
        blockTimestamps.set(result.number, result.timestamp);
      }
    }
  }
};

/** Event ids are `<txHash>-<logIndex>`. */
const getLogIndex = (event: EscrowEventRecord) => Number(event.id.split('-').pop()) || 0;

/** Every escrow event of a payer, oldest first. */
export const loadPayerEscrowEvents = async (payer: string): Promise<TimedEscrowEvent[]> => {
  const events = await getEscrowEvents({ chainId: CHAIN_ID, payer });
  await loadBlockTimestamps(events.map((event) => event.block));
  return events
    .map((event) => ({ ...event, logIndex: getLogIndex(event), timestamp: blockTimestamps.get(event.block) ?? null }))
    .sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
};

export const getEscrowToken = (address: string | undefined): EscrowToken | null => {
  if (!isUsdc(address)) {
    return null;
  }
  return { address: USDC.address, decimals: USDC.decimals, symbol: USDC.symbol };
};

export const toTokenAmount = (raw: string | bigint | undefined, token: EscrowToken) =>
  Number(ethers.formatUnits(raw ?? '0', token.decimals));

const SERVICE_PROOF = /^service-(?:start|extend):(.+)$/;

/** The node signs claims with `service-start:<id>` / `service-extend:<id>`, or the compute job as JSON. */
export const decodeClaimProof = (proof: string | undefined): EscrowJobRef | null => {
  if (!proof) {
    return null;
  }
  let text: string;
  try {
    text = ethers.toUtf8String(proof);
  } catch {
    return null;
  }
  const service = SERVICE_PROOF.exec(text);
  if (service) {
    return { id: service[1], kind: 'service' };
  }
  try {
    const job = JSON.parse(text);
    return typeof job?.jobId === 'string' ? { id: job.jobId, kind: 'compute' } : null;
  } catch {
    return null;
  }
};

/** On-chain jobIds are the sha256 of the job or service id, emitted as a decimal uint256. */
export const formatEscrowJobId = (jobId: string) => {
  try {
    return ethers.toBeHex(BigInt(jobId), 32);
  } catch {
    return jobId;
  }
};

const LOCK_EVENT_TYPES = new Set([
  'Lock',
  'ReLock',
  'LockSponsored',
  'SponsorRefunded',
  'Subsidized',
  'Claimed',
  'Canceled',
]);

const addTo = (map: Map<string, bigint>, key: string, raw: string | undefined, sign = BigInt(1)) =>
  map.set(key, (map.get(key) ?? BigInt(0)) + sign * BigInt(raw ?? '0'));

const buildCycle = (events: TimedEscrowEvent[], token: EscrowToken): EscrowLockCycle => {
  let locked = 0;
  let sponsored = BigInt(0);
  let claimed: TimedEscrowEvent | null = null;
  let canceled: TimedEscrowEvent | null = null;
  const subsidyByProvider = new Map<string, bigint>();
  for (const event of events) {
    const provider = event.provider?.toLowerCase() ?? '';
    switch (event.eventType) {
      case 'Lock':
        locked = toTokenAmount(event.amount, token);
        break;
      case 'ReLock':
        locked = toTokenAmount(event.newAmount, token);
        break;
      case 'LockSponsored':
        addTo(subsidyByProvider, provider, event.amount);
        sponsored += BigInt(event.amount ?? '0');
        break;
      case 'SponsorRefunded':
        addTo(subsidyByProvider, provider, event.amount, BigInt(-1));
        sponsored -= BigInt(event.amount ?? '0');
        break;
      case 'Subsidized':
        addTo(subsidyByProvider, provider, event.subsidyAmount);
        break;
      case 'Claimed':
        claimed = event;
        break;
      case 'Canceled':
        canceled = event;
        break;
    }
  }
  const first = events[0];
  const status: EscrowLockStatus = claimed ? 'claimed' : canceled ? 'canceled' : 'locked';
  return {
    cost: claimed ? toTokenAmount(claimed.amount, token) : canceled ? 0 : locked,
    events,
    id: first.id,
    job: decodeClaimProof(claimed?.proof),
    jobId: first.jobId ?? '',
    payee: first.payee ?? '',
    status,
    sponsored: toTokenAmount(sponsored, token),
    subsidyByProvider,
    timestamp: first.timestamp,
    token,
  };
};

/** Expects events oldest first. Locks in unsupported tokens are skipped. */
export const groupLockCycles = (events: TimedEscrowEvent[]): EscrowLockCycle[] => {
  const open = new Map<string, TimedEscrowEvent[]>();
  const closed = new Map<string, { events: TimedEscrowEvent[]; txHash: string }>();
  const cycles: TimedEscrowEvent[][] = [];
  for (const event of events) {
    if (!LOCK_EVENT_TYPES.has(event.eventType) || !event.jobId) {
      continue;
    }
    const key = `${event.payee}-${event.jobId}-${event.token}`;
    const lastClosed = closed.get(key);
    if (lastClosed && lastClosed.txHash === event.txHash) {
      lastClosed.events.push(event);
      continue;
    }
    const current = open.get(key) ?? [];
    if (current.length === 0) {
      open.set(key, current);
      cycles.push(current);
    }
    current.push(event);
    if (event.eventType === 'Claimed' || event.eventType === 'Canceled') {
      open.delete(key);
      closed.set(key, { events: current, txHash: event.txHash });
    }
  }
  return cycles.flatMap((cycleEvents) => {
    const token = getEscrowToken(cycleEvents[0].token);
    return token ? [buildCycle(cycleEvents, token)] : [];
  });
};
