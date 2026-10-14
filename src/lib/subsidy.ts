import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { getRpc } from '@/lib/constants';
import { getEscrowEvents } from '@/services/nodeService';
import Address from '@oceanprotocol/contracts/addresses/address.json';
import {
  OneTimeSubsidyProvider,
  OPFSubsidyProvider,
  SubsidyBucket,
  SubsidyKind,
  SubsidyMode,
  SubsidyModeConfig,
  SubsidyView,
} from '@oceanprotocol/lib';
import { ethers } from 'ethers';

/** Values are part of the on-chain ABI. */
export enum SubsidyJobType {
  COMPUTE = 1,
  SERVICE = 2,
}

export type SubsidyWindow = {
  limit: number;
  periodSeconds: number;
  remaining: number;
  resetsAt: Date | null;
  unlimited: boolean;
  used: number;
};

export type SubsidyAllowance = {
  limit: number;
  remaining: number;
  used: number;
};

/** Same-kind providers add up; the highest percentage wins. */
export type SubsidyProgram = {
  discount: { addresses: string[]; percent: number; windows: SubsidyWindow[] } | null;
  oneTime: { addresses: string[]; credit: number; percent: number } | null;
  /** Escrow lock order: one-time credits first, then discounts. */
  providers: string[];
};

export type SubsidyUsage = {
  discount: { remaining: number; windows: SubsidyWindow[] } | null;
  oneTime: SubsidyAllowance | null;
  /** Every provider is paused or has the token disabled. */
  paused: boolean;
  /** On at least one provider's user access list. */
  userAllowed: boolean;
};

export type SubsidyQuote = {
  discount: number;
  oneTime: number;
  /** Lock order. */
  providers: string[];
  total: number;
  /** Discount ignoring usage windows. */
  uncappedDiscount: number;
};

const getToken = () => getSupportedTokens().USDC;

export const isSubsidyToken = (tokenAddress: string | undefined) =>
  !!tokenAddress && tokenAddress.toLowerCase() === getToken().address.toLowerCase();

const getReadSigner = () => new ethers.VoidSigner(ethers.ZeroAddress, new ethers.JsonRpcProvider(getRpc()));

const getView = (address: string) => new SubsidyView(getReadSigner(), address, CHAIN_ID);

export const getSubsidyProviderAddresses = (): string[] => {
  const override = process.env.NEXT_PUBLIC_SUBSIDY_PROVIDERS;
  if (override) {
    return override
      .split(',')
      .map((address) => address.trim())
      .filter((address) => ethers.isAddress(address));
  }
  const config = Object.values(Address).find((chainConfig) => chainConfig.chainId === CHAIN_ID);
  return (config as { SubsidyProviders?: string[] } | undefined)?.SubsidyProviders ?? [];
};

const toWindow = (bucket: SubsidyBucket): SubsidyWindow => ({
  limit: Number(bucket.limit),
  periodSeconds: Number(bucket.periodSeconds),
  remaining: Number(bucket.remaining),
  resetsAt: Number(bucket.resetsAt) > 0 ? new Date(Number(bucket.resetsAt) * 1000) : null,
  unlimited: bucket.unlimited,
  used: Number(bucket.used),
});

const DAY_SECONDS = 86400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const ROLLING_MONTH_SECONDS = 4 * WEEK_SECONDS;

const toLimitWindow = (periodSeconds: number, limit: string): SubsidyWindow => ({
  limit: Number(limit),
  periodSeconds,
  remaining: Number(limit),
  resetsAt: null,
  unlimited: Number(limit) === 0,
  used: 0,
});

export const getBindingWindow = (windows: SubsidyWindow[]): SubsidyWindow | null =>
  windows
    .filter((window) => !window.unlimited)
    .reduce<SubsidyWindow | null>((min, window) => (!min || window.remaining < min.remaining ? window : min), null);

const mergeWindows = (windowSets: SubsidyWindow[][]): SubsidyWindow[] => {
  const byPeriod = new Map<number, SubsidyWindow>();
  for (const window of windowSets.flat()) {
    const merged = byPeriod.get(window.periodSeconds);
    if (!merged) {
      byPeriod.set(window.periodSeconds, { ...window });
      continue;
    }
    merged.limit += window.limit;
    merged.remaining += window.remaining;
    merged.used += window.used;
    merged.unlimited = merged.unlimited || window.unlimited;
    if (window.resetsAt && (!merged.resetsAt || window.resetsAt < merged.resetsAt)) {
      merged.resetsAt = window.resetsAt;
    }
  }
  return [...byPeriod.values()].sort((a, b) => a.periodSeconds - b.periodSeconds);
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const minRemaining = (windows: SubsidyWindow[]) =>
  windows.filter((window) => !window.unlimited).reduce((min, window) => Math.min(min, window.remaining), Infinity);

type ProgramEntry =
  | { address: string; credit: number; kind: SubsidyKind.ONE_TIME; percent: number }
  | { address: string; kind: SubsidyKind.ROLLING_WINDOW; percent: number; windows: SubsidyWindow[] };

// Only lock-time (prepaid) providers count.
const loadProgramEntry = async (address: string): Promise<ProgramEntry | null> => {
  const token = getToken();
  const view = getView(address);
  if (!(await view.isSubsidyLockProvider())) {
    return null;
  }
  if ((await view.isSubsidyModeConfig()) && (await view.subsidyModeConfig()) === SubsidyModeConfig.REFUND_ONLY) {
    return null;
  }
  const kind = await view.subsidyKind();
  if (kind === SubsidyKind.ONE_TIME) {
    const config = await new OneTimeSubsidyProvider(getReadSigner(), address, CHAIN_ID).getTokenConfig(
      token.address,
      token.decimals
    );
    if (!config.enabled) {
      return null;
    }
    return { address, credit: Number(config.defaultCredit), kind, percent: Number(config.pctBps) / 100 };
  }
  if (kind === SubsidyKind.ROLLING_WINDOW) {
    const limits = await new OPFSubsidyProvider(getReadSigner(), address, CHAIN_ID).getTokenLimits(
      token.address,
      token.decimals
    );
    if (!limits.enabled) {
      return null;
    }
    const windows = [
      toLimitWindow(DAY_SECONDS, limits.daily),
      toLimitWindow(WEEK_SECONDS, limits.weekly),
      toLimitWindow(ROLLING_MONTH_SECONDS, limits.monthly),
    ];
    return { address, kind, percent: Number(limits.pctBps) / 100, windows };
  }
  return null;
};

export const loadSubsidyProgram = async (): Promise<SubsidyProgram | null> => {
  const entries = await Promise.all(
    getSubsidyProviderAddresses().map((address) =>
      loadProgramEntry(address).catch((error) => {
        console.error(`Failed to read subsidy provider ${address}`, error);
        return null;
      })
    )
  );
  const oneTimes = entries.filter(
    (entry): entry is Extract<ProgramEntry, { kind: SubsidyKind.ONE_TIME }> => entry?.kind === SubsidyKind.ONE_TIME
  );
  const discounts = entries.filter(
    (entry): entry is Extract<ProgramEntry, { kind: SubsidyKind.ROLLING_WINDOW }> =>
      entry?.kind === SubsidyKind.ROLLING_WINDOW
  );
  if (oneTimes.length === 0 && discounts.length === 0) {
    return null;
  }
  return {
    discount:
      discounts.length > 0
        ? {
            addresses: discounts.map((entry) => entry.address),
            percent: Math.max(...discounts.map((entry) => entry.percent)),
            windows: mergeWindows(discounts.map((entry) => entry.windows)),
          }
        : null,
    oneTime:
      oneTimes.length > 0
        ? {
            addresses: oneTimes.map((entry) => entry.address),
            credit: sum(oneTimes.map((entry) => entry.credit)),
            percent: Math.max(...oneTimes.map((entry) => entry.percent)),
          }
        : null,
    providers: [...oneTimes, ...discounts].map((entry) => entry.address),
  };
};

export const loadSubsidyUsage = async (program: SubsidyProgram, payer: string): Promise<SubsidyUsage> => {
  const token = getToken();
  const readReports = (addresses: string[]) =>
    Promise.all(addresses.map((address) => getView(address).subsidyBuckets(payer, token.address, token.decimals)));
  const [oneTimeReports, discountReports] = await Promise.all([
    readReports(program.oneTime?.addresses ?? []),
    readReports(program.discount?.addresses ?? []),
  ]);
  const reports = [...oneTimeReports, ...discountReports];
  const oneTimeBuckets = oneTimeReports.flatMap((report) => report.buckets.slice(0, 1));
  const discountWindows = mergeWindows(discountReports.map((report) => report.buckets.map(toWindow)));
  return {
    discount:
      discountReports.length > 0 ? { remaining: minRemaining(discountWindows), windows: discountWindows } : null,
    oneTime:
      oneTimeBuckets.length > 0
        ? {
            limit: sum(oneTimeBuckets.map((bucket) => Number(bucket.limit))),
            remaining: sum(oneTimeBuckets.map((bucket) => Number(bucket.remaining))),
            used: sum(oneTimeBuckets.map((bucket) => Number(bucket.used))),
          }
        : null,
    paused: reports.length > 0 && reports.every((report) => report.paused || !report.tokenEnabled),
    userAllowed: reports.some((report) => report.userAllowed),
  };
};

export const isNodeSubsidized = async (program: SubsidyProgram, nodeAddress: string): Promise<boolean> => {
  const allowed = await Promise.all(program.providers.map((address) => getView(address).isNodeAllowed(nodeAddress)));
  return allowed.some(Boolean);
};

/** Mirrors the escrow lock: each provider sees what the previous ones left uncovered. */
export const quoteSubsidy = async ({
  cost,
  jobType,
  nodeAddress,
  payer,
  program,
}: {
  cost: number;
  jobType: SubsidyJobType;
  nodeAddress: string;
  payer: string;
  program: SubsidyProgram;
}): Promise<SubsidyQuote> => {
  const token = getToken();
  const amount = cost.toFixed(token.decimals);
  let remaining = cost;
  const covered: Record<string, number> = {};
  for (const address of program.providers) {
    if (remaining <= 0) {
      break;
    }
    const quote = await getView(address).quoteSubsidyByMode(
      nodeAddress,
      payer,
      jobType,
      token.address,
      amount,
      remaining.toFixed(token.decimals),
      SubsidyMode.PREFUNDED,
      token.decimals
    );
    const subsidy = Math.min(Number(quote.subsidy), remaining);
    if (subsidy > 0) {
      covered[address] = subsidy;
      remaining -= subsidy;
    }
  }
  const coveredBy = (addresses: string[] = []) => sum(addresses.map((address) => covered[address] ?? 0));
  const oneTime = coveredBy(program.oneTime?.addresses);
  const discount = coveredBy(program.discount?.addresses);
  return {
    discount,
    oneTime,
    providers: program.providers.filter((address) => covered[address] > 0),
    total: oneTime + discount,
    uncappedDiscount: program.discount ? ((cost - oneTime) * program.discount.percent) / 100 : 0,
  };
};

/** `undefined` leaves the choice to the node. */
export const getJobSubsidyProviders = async ({
  cost,
  jobType,
  nodeAddress,
  payer,
  tokenAddress,
}: {
  cost: number;
  jobType: SubsidyJobType;
  nodeAddress: string;
  payer: string;
  tokenAddress: string;
}): Promise<string[] | undefined> => {
  if (!isSubsidyToken(tokenAddress) || cost <= 0) {
    return undefined;
  }
  try {
    const program = await loadSubsidyProgram();
    if (!program) {
      return undefined;
    }
    const quote = await quoteSubsidy({ cost, jobType, nodeAddress, payer, program });
    return quote.providers.length > 0 ? quote.providers : undefined;
  } catch (error) {
    console.error('Failed to resolve subsidy providers for job', error);
    return undefined;
  }
};

export type SubsidyHistoryEntry = {
  date: Date | null;
  discount: number;
  jobId: string;
  node: string;
  oneTime: number;
  total: number;
};

const HISTORY_PAGE_SIZE = 250;

/** Newest first, from `LockSponsored` events. */
export const loadSubsidyHistory = async (program: SubsidyProgram, payer: string): Promise<SubsidyHistoryEntry[]> => {
  const token = getToken();
  const events = await getEscrowEvents({
    chainId: CHAIN_ID,
    eventType: 'LockSponsored',
    payer,
    size: HISTORY_PAGE_SIZE,
    token: token.address,
  });
  const oneTimeAddresses = new Set(program.oneTime?.addresses.map((address) => address.toLowerCase()));
  const discountAddresses = new Set(program.discount?.addresses.map((address) => address.toLowerCase()));
  const entries = new Map<string, SubsidyHistoryEntry & { block: number }>();
  for (const event of events) {
    const provider = event.provider?.toLowerCase();
    const isOneTime = !!provider && oneTimeAddresses.has(provider);
    if (!event.jobId || !event.amount || (!isOneTime && !(provider && discountAddresses.has(provider)))) {
      continue;
    }
    const key = `${event.payee}-${event.jobId}`;
    const entry = entries.get(key) ?? {
      block: event.block,
      date: null,
      discount: 0,
      jobId: event.jobId,
      node: event.payee ?? '',
      oneTime: 0,
      total: 0,
    };
    const amount = Number(ethers.formatUnits(event.amount, token.decimals));
    if (isOneTime) {
      entry.oneTime += amount;
    } else {
      entry.discount += amount;
    }
    entry.total += amount;
    entry.block = Math.max(entry.block, event.block);
    entries.set(key, entry);
  }
  const sorted = [...entries.values()].sort((a, b) => b.block - a.block);
  const rpc = new ethers.JsonRpcProvider(getRpc());
  const blocks = await Promise.all(
    [...new Set(sorted.map((entry) => entry.block))].map((block) => rpc.getBlock(block).catch(() => null))
  );
  const timestamps = new Map(blocks.filter((block) => !!block).map((block) => [block.number, block.timestamp]));
  return sorted.map(({ block, ...entry }) => ({
    ...entry,
    date: timestamps.has(block) ? new Date(timestamps.get(block)! * 1000) : null,
  }));
};

const PERIOD_LABELS: Record<number, string> = {
  86400: 'day',
  604800: 'week',
};

export const formatSubsidyPeriod = (periodSeconds: number): string => {
  if (PERIOD_LABELS[periodSeconds]) {
    return PERIOD_LABELS[periodSeconds];
  }
  const days = Math.round(periodSeconds / 86400);
  return days === 1 ? 'day' : `${days} days`;
};

export const formatSubsidyReset = (resetsAt: Date): string => {
  const day = resetsAt.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  });
  const time = resetsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${day}, ${time} UTC`;
};

const SHORTFALL_PATTERN = /does not have enough funds|Exceeds maxLockedAmount/i;

/** Replaces a subsidy-shortfall lock revert with a readable error. */
export const startWithSubsidy = async <T>(subsidyProviders: string[] | undefined, start: () => Promise<T>) => {
  try {
    return await start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (subsidyProviders?.length && SHORTFALL_PATTERN.test(message)) {
      throw new Error(
        "Your job didn't start: the subsidy covered less than quoted and your escrow can't cover the rest. Nothing was charged. Add funds to escrow and try again."
      );
    }
    throw error;
  }
};
