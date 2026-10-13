import { SUBSIDY_DISCOUNT_PERCENT, SUBSIDY_ONE_TIME_CREDIT, SUBSIDY_WEEKLY_DISCOUNT_LIMIT } from '@/constants/subsidy';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantStatus } from '@/types/grant';
import { useQuery } from '@tanstack/react-query';

export type SubsidyAllowance = {
  limit: number;
  remaining: number;
  used: number;
};

export type SubsidyUsage = {
  discount: SubsidyAllowance & { resetsAt: Date };
  oneTime: SubsidyAllowance;
  /** Program paused or out of funds: nothing is drawable right now. */
  paused: boolean;
  /** The wallet passes the subsidy contract's access list. */
  userAllowed: boolean;
};

export type SubsidyQuote = {
  discount: number;
  /** What the 50% discount would have been without the weekly limit. */
  uncappedDiscount: number;
  oneTime: number;
  total: number;
};

const STALE_TIME = 30_000;

export const getNextWeeklyReset = (now = new Date()): Date => {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilThursday = (4 - reset.getUTCDay() + 7) % 7 || 7;
  reset.setUTCDate(reset.getUTCDate() + daysUntilThursday);
  return reset;
};

export const formatSubsidyReset = (resetsAt: Date, weekday: 'long' | 'short' = 'long'): string => {
  const day = resetsAt.toLocaleDateString('en-US', { timeZone: 'UTC', weekday });
  const time = resetsAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return `${day} ${time} UTC`;
};

/**
 * The one-time credit is drawn first; the discount applies to whatever it leaves, capped by what is
 * left of the weekly limit.
 */
export const quoteSubsidy = (cost: number, usage: SubsidyUsage): SubsidyQuote => {
  const oneTime = Math.min(cost, usage.oneTime.remaining);
  const uncappedDiscount = ((cost - oneTime) * SUBSIDY_DISCOUNT_PERCENT) / 100;
  const discount = Math.min(uncappedDiscount, usage.discount.remaining);
  return { discount, oneTime, total: oneTime + discount, uncappedDiscount };
};

// TODO: replace with SubsidyView reads (subsidyBuckets, isNodeAllowed) once the subsidy providers
// are deployed on every chain the dashboard targets.
const fetchMockSubsidyUsage = async (userAllowed: boolean): Promise<SubsidyUsage> => ({
  discount: {
    limit: SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
    remaining: SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
    resetsAt: getNextWeeklyReset(),
    used: 0,
  },
  oneTime: { limit: SUBSIDY_ONE_TIME_CREDIT, remaining: SUBSIDY_ONE_TIME_CREDIT, used: 0 },
  paused: false,
  userAllowed,
});

const fetchMockIsNodeSubsidized = async (): Promise<boolean> => true;

/** Subsidy limits and usage for the connected wallet. Only loads once the subsidy is claimed. */
export const useSubsidyUsage = () => {
  const { account } = useOceanAccount();
  const { grantStatus } = useProfileContext();
  const isClaimed = grantStatus === GrantStatus.CLAIMED;

  return useQuery({
    queryKey: ['subsidy-usage', account.address],
    enabled: !!account.address && isClaimed,
    staleTime: STALE_TIME,
    queryFn: () => fetchMockSubsidyUsage(isClaimed),
  });
};

/** Whether the node behind `nodeAddress` accepts the subsidy. */
export const useIsNodeSubsidized = (nodeAddress: string | undefined) =>
  useQuery({
    queryKey: ['subsidy-node-allowed', nodeAddress?.toLowerCase()],
    enabled: !!nodeAddress,
    staleTime: STALE_TIME,
    queryFn: fetchMockIsNodeSubsidized,
  });
