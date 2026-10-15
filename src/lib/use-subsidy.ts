import { CHAIN_ID } from '@/constants/chains';
import { groupLockCycles } from '@/lib/escrow-events';
import {
  buildSubsidyHistory,
  isNodeSubsidized,
  isSubsidyToken,
  loadSubsidyProgram,
  loadSubsidyUsage,
  quoteSubsidy,
  SubsidyJobType,
} from '@/lib/subsidy';
import { usePayerEscrowEvents } from '@/lib/use-escrow-events';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

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
  const { data: quote, isFetching } = useSubsidyQuote(params);
  return {
    isQuoting: isFetching,
    payerCost: Math.max(0, params.cost - (quote?.total ?? 0)),
  };
};
