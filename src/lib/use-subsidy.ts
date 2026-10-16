import { CHAIN_ID } from '@/constants/chains';
import { groupLockCycles } from '@/lib/escrow-events';
import {
  buildSubsidyHistory,
  getSubsidyJobTypeName,
  isNodeSubsidized,
  isSubsidyToken,
  loadSubsidyProgram,
  loadSubsidyUsage,
  quoteSubsidy,
  startWithSubsidy,
  SubsidyJobType,
} from '@/lib/subsidy';
import { usePayerEscrowEvents } from '@/lib/use-escrow-events';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { useCallback, useMemo } from 'react';

const PROGRAM_STALE_TIME = 5 * 60_000;
const USAGE_STALE_TIME = 30_000;

/** `null` when no prepaid provider is configured. */
export const useSubsidyProgram = () =>
  useQuery({
    queryKey: ['subsidy-program', CHAIN_ID],
    staleTime: PROGRAM_STALE_TIME,
    queryFn: loadSubsidyProgram,
  });

/** `userAllowed` decides whether the wallet gets the subsidy. */
export const useSubsidyUsage = () => {
  const { account } = useOceanAccount();
  const { data: program } = useSubsidyProgram();

  return useQuery({
    queryKey: ['subsidy-usage', CHAIN_ID, account.address],
    enabled: !!account.address && !!program,
    staleTime: USAGE_STALE_TIME,
    queryFn: () => loadSubsidyUsage(program!, account.address!),
  });
};

export const useIsNodeSubsidized = (nodeAddress: string | undefined) => {
  const { data: program } = useSubsidyProgram();

  return useQuery({
    queryKey: ['subsidy-node-allowed', CHAIN_ID, nodeAddress?.toLowerCase()],
    enabled: !!nodeAddress && !!program,
    staleTime: PROGRAM_STALE_TIME,
    queryFn: () => isNodeSubsidized(program!, nodeAddress!),
  });
};

export const useSubsidyQuote = ({
  cost,
  jobType,
  nodeAddress,
  tokenAddress,
}: {
  cost: number;
  jobType: SubsidyJobType;
  nodeAddress: string | undefined;
  tokenAddress: string | undefined;
}) => {
  const { account } = useOceanAccount();
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();

  return useQuery({
    queryKey: ['subsidy-quote', CHAIN_ID, account.address, nodeAddress?.toLowerCase(), jobType, cost],
    enabled:
      !!account.address &&
      !!nodeAddress &&
      !!usage?.userAllowed &&
      !!program &&
      isSubsidyToken(tokenAddress) &&
      cost > 0,
    staleTime: USAGE_STALE_TIME,
    queryFn: () =>
      quoteSubsidy({ cost, jobType, nodeAddress: nodeAddress!, payer: account.address!, program: program! }),
  });
};

export const useSubsidyHistory = () => {
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();
  const { data: events, isError, isLoading } = usePayerEscrowEvents({ enabled: !!usage?.userAllowed && !!program });
  const history = useMemo(
    () => (program && events ? buildSubsidyHistory(program, groupLockCycles(events)) : undefined),
    [events, program]
  );

  return { data: history, isError, isLoading };
};

/** `cost` minus the subsidy quote. */
export const usePayerCost = (params: Parameters<typeof useSubsidyQuote>[0]) => {
  const { isLoading: isProgramLoading } = useSubsidyProgram();
  const { isLoading: isUsageLoading } = useSubsidyUsage();
  const { data: quote, isFetching } = useSubsidyQuote(params);
  return {
    isQuoting: isProgramLoading || isUsageLoading || isFetching,
    payerCost: Math.max(0, params.cost - (quote?.total ?? 0)),
  };
};

/** Usage, quotes and escrow history change once a job locks funds or the wallet joins the access list. */
export const useInvalidateSubsidyData = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all(
        ['subsidy-usage', 'subsidy-quote', 'escrow-events'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      ),
    [queryClient]
  );
};

type SubsidyStartContext = {
  action: 'prolong' | 'start';
  jobType: SubsidyJobType;
  subsidyProviders: string[] | undefined;
};

export const useStartWithSubsidy = () => {
  const invalidateSubsidyData = useInvalidateSubsidyData();
  return useCallback(
    async <T>(start: () => Promise<T>, { action, jobType, subsidyProviders }: SubsidyStartContext) => {
      try {
        const result = await startWithSubsidy(start);
        if (subsidyProviders?.length) {
          posthog.capture('subsidy_applied', { action, jobType: getSubsidyJobTypeName(jobType) });
        }
        return result;
      } finally {
        invalidateSubsidyData();
      }
    },
    [invalidateSubsidyData]
  );
};
