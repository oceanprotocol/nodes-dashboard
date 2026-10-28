import { CHAIN_ID } from '@/constants/chains';
import { USDC } from '@/constants/tokens';
import { getRpc } from '@/lib/constants';
import { EscrowJobRef, EscrowLockCycle, EscrowLockStatus, toTokenAmount } from '@/lib/escrow-events';
import { recallCustomSubsidies } from '@/services/custom-subsidies-memory';
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

export const getSubsidyJobTypeName = (jobType: SubsidyJobType) =>
  jobType === SubsidyJobType.COMPUTE ? 'compute' : 'service';

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
  /** Custom providers that cover part of the job, in lock order. */
  custom: { address: string; amount: number }[];
  discount: number;
  oneTime: number;
  /** Lock order. */
  providers: string[];
  total: number;
  /** Discount ignoring usage windows. */
  uncappedDiscount: number;
};

let _readSigner: ethers.VoidSigner | null = null;

const getReadSigner = () => {
  if (!_readSigner) {
    _readSigner = new ethers.VoidSigner(ethers.ZeroAddress, new ethers.JsonRpcProvider(getRpc()));
  }
  return _readSigner;
};

const getView = (address: string) => new SubsidyView(getReadSigner(), address, CHAIN_ID);

/** Escrow `maxSponsorsPerLock()`. */
const MAX_SPONSORS_PER_LOCK = 10;

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

export const cappedWindows = (windows: SubsidyWindow[]) => windows.filter((window) => !window.unlimited);

export const getBindingWindow = (windows: SubsidyWindow[]): SubsidyWindow | null =>
  cappedWindows(windows).reduce<SubsidyWindow | null>(
    (min, window) => (!min || window.remaining < min.remaining ? window : min),
    null
  );

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
  cappedWindows(windows).reduce((min, window) => Math.min(min, window.remaining), Infinity);

type ProgramEntry =
  | { address: string; credit: number; kind: SubsidyKind.ONE_TIME; percent: number }
  | { address: string; kind: SubsidyKind.ROLLING_WINDOW; percent: number; windows: SubsidyWindow[] };

// Only lock-time (prepaid) providers count.
const loadProgramEntry = async (address: string): Promise<ProgramEntry | null> => {
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
      USDC.address,
      USDC.decimals
    );
    if (!config.enabled) {
      return null;
    }
    return { address, credit: Number(config.defaultCredit), kind, percent: Number(config.pctBps) / 100 };
  }
  if (kind === SubsidyKind.ROLLING_WINDOW) {
    const limits = await new OPFSubsidyProvider(getReadSigner(), address, CHAIN_ID).getTokenLimits(
      USDC.address,
      USDC.decimals
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

export const loadSubsidyProgram = async (
  addresses: string[] = getSubsidyProviderAddresses()
): Promise<SubsidyProgram | null> => {
  const results = await Promise.allSettled(addresses.map(loadProgramEntry));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to read subsidy provider ${addresses[index]}`, result.reason);
    }
  });
  if (results.length > 0 && results.every((result) => result.status === 'rejected')) {
    throw new Error('Failed to read subsidy providers');
  }
  const entries = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
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

/** Throws a readable error when the address can't be used as a custom subsidy. */
export const loadCustomSubsidyProgram = async (address: string): Promise<SubsidyProgram> => {
  if ((await getReadSigner().provider!.getCode(address)) === '0x') {
    throw new Error('No contract found at this address');
  }
  if (!(await getView(address).isSubsidyView())) {
    throw new Error("This contract isn't a subsidy");
  }
  const program = await loadSubsidyProgram([address]);
  if (!program) {
    throw new Error(`This subsidy can't prepay jobs in ${USDC.symbol}`);
  }
  return program;
};

const loadCustomSubsidyProviders = async (payer: string): Promise<string[]> => {
  const addresses = recallCustomSubsidies(payer);
  const entries = await Promise.allSettled(addresses.map(loadProgramEntry));
  return addresses.filter((_, index) => {
    const entry = entries[index];
    return entry.status === 'fulfilled' && !!entry.value;
  });
};

export const loadSubsidyUsage = async (program: SubsidyProgram, payer: string): Promise<SubsidyUsage> => {
  const readReports = (addresses: string[]) =>
    Promise.all(addresses.map((address) => getView(address).subsidyBuckets(payer, USDC.address, USDC.decimals)));
  const [oneTimeReports, discountReports] = await Promise.all([
    readReports(program.oneTime?.addresses ?? []),
    readReports(program.discount?.addresses ?? []),
  ]);
  const reports = [...oneTimeReports, ...discountReports];
  const oneTimeBuckets = oneTimeReports.flatMap((report) => report.buckets.slice(0, 1));
  const discountWindowSets = discountReports.map((report) => report.buckets.map(toWindow));
  return {
    discount:
      discountReports.length > 0
        ? {
            remaining: sum(discountWindowSets.map(minRemaining)),
            windows: mergeWindows(discountWindowSets),
          }
        : null,
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

/**
 * Mirrors the escrow lock: each provider sees what the previous ones left uncovered.
 * Custom providers lock first, in the order added, then OPF ones; a custom provider that fails to quote is skipped.
 */
export const quoteSubsidy = async ({
  cost,
  customProviders = [],
  jobType,
  nodeAddress,
  payer,
  program,
}: {
  cost: number;
  customProviders?: string[];
  jobType: SubsidyJobType;
  nodeAddress: string;
  payer: string;
  program: SubsidyProgram | null;
}): Promise<SubsidyQuote> => {
  const amount = cost.toFixed(USDC.decimals);
  const programProviders = program?.providers ?? [];
  const programAddresses = new Set(programProviders.map((address) => address.toLowerCase()));
  const custom = customProviders.filter((address) => !programAddresses.has(address.toLowerCase()));
  const lockOrder = [...custom, ...programProviders];
  let remaining = cost;
  const covered: Record<string, number> = {};
  for (const address of lockOrder) {
    if (remaining <= 0 || Object.keys(covered).length >= MAX_SPONSORS_PER_LOCK) {
      break;
    }
    let quoted: number;
    try {
      const quote = await getView(address).quoteSubsidyByMode(
        nodeAddress,
        payer,
        jobType,
        USDC.address,
        amount,
        remaining.toFixed(USDC.decimals),
        SubsidyMode.PREFUNDED,
        USDC.decimals
      );
      quoted = Number(quote.subsidy);
    } catch (error) {
      if (!custom.includes(address)) {
        throw error;
      }
      console.error(`Failed to quote custom subsidy ${address}`, error);
      continue;
    }
    const subsidy = Math.min(quoted, remaining);
    if (subsidy > 0) {
      covered[address] = subsidy;
      remaining -= subsidy;
    }
  }
  const coveredBy = (addresses: string[] = []) => sum(addresses.map((address) => covered[address] ?? 0));
  const oneTime = coveredBy(program?.oneTime?.addresses);
  const discount = coveredBy(program?.discount?.addresses);
  const customCovered = custom
    .filter((address) => covered[address] > 0)
    .map((address) => ({ address, amount: covered[address] }));
  const customTotal = sum(customCovered.map((entry) => entry.amount));
  return {
    custom: customCovered,
    discount,
    oneTime,
    providers: lockOrder.filter((address) => covered[address] > 0),
    total: customTotal + oneTime + discount,
    uncappedDiscount: program?.discount ? ((cost - customTotal - oneTime) * program.discount.percent) / 100 : 0,
  };
};

/** `undefined` leaves the choice to the node. */
export const getJobSubsidyProviders = async ({
  cost,
  jobType,
  nodeAddress,
  payer,
}: {
  cost: number;
  jobType: SubsidyJobType;
  nodeAddress: string;
  payer: string;
}): Promise<string[] | undefined> => {
  if (cost <= 0) {
    return undefined;
  }
  try {
    const [program, customProviders] = await Promise.all([loadSubsidyProgram(), loadCustomSubsidyProviders(payer)]);
    if (!program && customProviders.length === 0) {
      return undefined;
    }
    const quote = await quoteSubsidy({ cost, customProviders, jobType, nodeAddress, payer, program });
    return quote.providers.length > 0 ? quote.providers : undefined;
  } catch (error) {
    console.error('Failed to resolve subsidy providers for job', error);
    return undefined;
  }
};

export type SubsidyHistoryEntry = {
  /** What the job or service cost in total, before the subsidy. */
  cost: number;
  custom: number;
  date: Date | null;
  discount: number;
  id: string;
  job: EscrowJobRef | null;
  jobId: string;
  node: string;
  oneTime: number;
  paid: number;
  status: EscrowLockStatus;
  total: number;
};

/**
 * Newest first. Canceled locks are dropped: their subsidy went back to the program.
 * Providers no longer in the program or the custom list count as discount.
 */
export const buildSubsidyHistory = (
  program: SubsidyProgram | null,
  customProviders: string[],
  cycles: EscrowLockCycle[]
): SubsidyHistoryEntry[] => {
  const oneTimeAddresses = new Set(program?.oneTime?.addresses.map((address) => address.toLowerCase()));
  const customAddresses = new Set(customProviders.map((address) => address.toLowerCase()));
  const sumProviders = (cycle: EscrowLockCycle, isIncluded: (provider: string) => boolean) =>
    toTokenAmount(
      [...cycle.subsidyByProvider]
        .filter(([provider]) => isIncluded(provider))
        .reduce((total, [, amount]) => total + amount, BigInt(0)),
      cycle.token
    );
  return cycles
    .filter((cycle) => cycle.status !== 'canceled')
    .map((cycle) => {
      const oneTime = sumProviders(cycle, (provider) => oneTimeAddresses.has(provider));
      const custom = sumProviders(cycle, (provider) => customAddresses.has(provider));
      const total = sumProviders(cycle, () => true);
      const discount = total - oneTime - custom;
      return {
        cost: cycle.cost,
        custom,
        date: cycle.timestamp ? new Date(cycle.timestamp * 1000) : null,
        discount,
        id: cycle.id,
        job: cycle.job,
        jobId: cycle.jobId,
        node: cycle.payee,
        oneTime,
        paid: Math.max(0, cycle.cost - total),
        status: cycle.status,
        total,
      };
    })
    .filter((entry) => entry.total > 0)
    .reverse();
};

const PERIOD_LABELS: Record<number, string> = {
  [DAY_SECONDS]: 'day',
  [WEEK_SECONDS]: 'week',
};

export const formatSubsidyPeriod = (periodSeconds: number): string => {
  if (PERIOD_LABELS[periodSeconds]) {
    return PERIOD_LABELS[periodSeconds];
  }
  const days = Math.round(periodSeconds / DAY_SECONDS);
  return days === 1 ? 'day' : `${days} days`;
};

export const formatSubsidyReset = (resetsAt: Date): string => {
  const day = resetsAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const time = resetsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
};

const SHORTFALL_PATTERN = /does not have enough funds|Exceeds maxLockedAmount/i;

/** Replaces an escrow-shortfall lock revert with a readable error. */
export const startWithSubsidy = async <T>(start: () => Promise<T>) => {
  try {
    return await start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (SHORTFALL_PATTERN.test(message)) {
      throw new Error(
        "Your job didn't start: your escrow funds or authorization don't cover your share of the cost. Nothing was charged. Check your escrow and try again."
      );
    }
    throw error;
  }
};
