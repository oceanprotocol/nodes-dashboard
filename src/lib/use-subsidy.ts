import { CHAIN_ID } from '@/constants/chains';
import {
  isNodeSubsidized,
  isSubsidyToken,
  loadSubsidyHistory,
  loadSubsidyProgram,
  loadSubsidyUsage,
  quoteSubsidy,
  SubsidyJobType,
} from '@/lib/subsidy';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useQuery } from '@tanstack/react-query';

const PROGRAM_STALE_TIME = 5 * 60_000;
const USAGE_STALE_TIME = 30_000;

/** The subsidy offer on this chain; `null` when no prepaid subsidy provider is configured. */
export const useSubsidyProgram = () =>
  useQuery({
    queryKey: ['subsidy-program', CHAIN_ID],
    staleTime: PROGRAM_STALE_TIME,
    queryFn: loadSubsidyProgram,
  });

/**
 * Limits and usage for the connected wallet. Its `userAllowed` — the wallet holds a token on a
 * provider's user access list — is what decides whether the wallet gets the subsidy.
 */
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

/** Whether the node behind `nodeAddress` accepts the subsidy. */
export const useIsNodeSubsidized = (nodeAddress: string | undefined) => {
  const { data: program } = useSubsidyProgram();

  return useQuery({
    queryKey: ['subsidy-node-allowed', CHAIN_ID, nodeAddress?.toLowerCase()],
    enabled: !!nodeAddress && !!program,
    staleTime: PROGRAM_STALE_TIME,
    queryFn: () => isNodeSubsidized(program!, nodeAddress!),
  });
};

/** What the subsidy would pre-fund for a payment of `cost` on `nodeAddress`. */
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

/** Jobs and services the subsidy pre-funded for the connected wallet. */
export const useSubsidyHistory = () => {
  const { account } = useOceanAccount();
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();

  return useQuery({
    queryKey: ['subsidy-history', CHAIN_ID, account.address],
    enabled: !!account.address && !!usage?.userAllowed && !!program,
    staleTime: USAGE_STALE_TIME,
    queryFn: () => loadSubsidyHistory(program!, account.address!),
  });
};

/** The part of `cost` the payer funds from escrow once the subsidy pre-funds its quote. */
export const usePayerCost = (params: Parameters<typeof useSubsidyQuote>[0]) => {
  const { data: quote, isFetching } = useSubsidyQuote(params);
  return {
    isQuoting: isFetching,
    payerCost: Math.max(0, params.cost - (quote?.total ?? 0)),
  };
};
