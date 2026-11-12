import { CHAIN_ID } from '@/constants/chains';
import { groupLockCycles } from '@/lib/escrow-events';
import {
  capturePaymentAccepted,
  capturePaymentFailed,
  PaidStartContext,
  PaymentReply,
  safeParseReply,
} from '@/lib/payment-analytics';
import {
  buildSubsidyHistory,
  getUpfrontCost,
  isNodeSubsidized,
  loadSubsidyProgram,
  loadSubsidyUsage,
  quoteSubsidy,
  resolveJobSubsidy,
  startWithSubsidy,
  SubsidyJobType,
  SubsidyProgram,
  SubsidyUsage,
} from '@/lib/subsidy';
import { usePayerEscrowEvents } from '@/lib/use-escrow-events';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { forgetCustomSubsidy, recallCustomSubsidies, rememberCustomSubsidy } from '@/services/custom-subsidies-memory';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { useCallback, useMemo } from 'react';

const PROGRAM_STALE_TIME = 5 * 60_000;
const USAGE_STALE_TIME = 30_000;

/** `null` when no subsidy provider is configured. */
export const useSubsidyProgram = () =>
  useQuery({
    queryKey: ['subsidy-program', CHAIN_ID],
    staleTime: PROGRAM_STALE_TIME,
    queryFn: () => loadSubsidyProgram(),
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

const customAddressesKey = (account: string | undefined) => [
  'subsidy-custom-addresses',
  CHAIN_ID,
  account?.toLowerCase(),
];

const customProgramKey = (address: string) => ['subsidy-custom-program', CHAIN_ID, address.toLowerCase()];

/** Subsidy contracts the wallet added by address, stored on this device. */
const useCustomSubsidyAddresses = () => {
  const { account } = useOceanAccount();

  return useQuery({
    queryKey: customAddressesKey(account.address),
    enabled: !!account.address,
    staleTime: Infinity,
    queryFn: () => recallCustomSubsidies(account.address!),
  });
};

export type CustomSubsidyData = {
  /** `null` when the contract can't pay for jobs in USDC. */
  program: SubsidyProgram | null;
  usage: SubsidyUsage | null;
};

export type CustomSubsidy = {
  address: string;
  data: CustomSubsidyData | undefined;
  isError: boolean;
  isLoading: boolean;
};

export const useCustomSubsidies = () => {
  const { account } = useOceanAccount();
  const queryClient = useQueryClient();
  const { data: addresses = [], isLoading: isAddressesLoading } = useCustomSubsidyAddresses();

  const results = useQueries({
    queries: addresses.map((address) => ({
      queryKey: ['subsidy-usage', CHAIN_ID, account.address, address.toLowerCase()],
      enabled: !!account.address,
      staleTime: USAGE_STALE_TIME,
      queryFn: async (): Promise<CustomSubsidyData> => {
        const program = await queryClient.fetchQuery({
          queryKey: customProgramKey(address),
          staleTime: PROGRAM_STALE_TIME,
          queryFn: () => loadSubsidyProgram([address]),
        });
        return { program, usage: program ? await loadSubsidyUsage(program, account.address!) : null };
      },
    })),
  });

  const subsidies: CustomSubsidy[] = addresses.map((address, index) => ({
    address,
    data: results[index]?.data,
    isError: !!results[index]?.isError,
    isLoading: !!results[index]?.isLoading,
  }));

  return {
    isLoading: isAddressesLoading || subsidies.some((subsidy) => subsidy.isLoading),
    subsidies,
  };
};

export const isCustomSubsidyActive = (data: CustomSubsidyData | undefined) =>
  !!data?.program && !!data.usage?.userAllowed && !data.usage.paused;

/** Custom providers the wallet can use now, in the order they were added. */
export const useActiveCustomSubsidies = () => {
  const { isLoading, subsidies } = useCustomSubsidies();
  return {
    addresses: subsidies.filter((subsidy) => isCustomSubsidyActive(subsidy.data)).map((subsidy) => subsidy.address),
    isLoading,
  };
};

export const useAddCustomSubsidy = () => {
  const { account } = useOceanAccount();
  const queryClient = useQueryClient();

  return useCallback(
    async (address: string, program: SubsidyProgram) => {
      if (!account.address) {
        return;
      }
      queryClient.setQueryData(customProgramKey(address), program);
      rememberCustomSubsidy(account.address, address);
      await queryClient.invalidateQueries({ queryKey: customAddressesKey(account.address) });
      posthog.capture('subsidy_custom_added', { address: address.toLowerCase() });
    },
    [account.address, queryClient]
  );
};

export const useRemoveCustomSubsidy = () => {
  const { account } = useOceanAccount();
  const queryClient = useQueryClient();

  return useCallback(
    async (address: string) => {
      if (!account.address) {
        return;
      }
      forgetCustomSubsidy(account.address, address);
      await queryClient.invalidateQueries({ queryKey: customAddressesKey(account.address) });
      posthog.capture('subsidy_custom_removed', { address: address.toLowerCase() });
    },
    [account.address, queryClient]
  );
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
}: {
  cost: number;
  jobType: SubsidyJobType;
  nodeAddress: string | undefined;
}) => {
  const { account } = useOceanAccount();
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();
  const { addresses: customProviders } = useActiveCustomSubsidies();
  const quotedProgram = program && usage?.userAllowed ? program : null;

  return useQuery({
    queryKey: [
      'subsidy-quote',
      CHAIN_ID,
      account.address,
      nodeAddress?.toLowerCase(),
      jobType,
      cost,
      !!quotedProgram,
      customProviders,
    ],
    enabled: !!account.address && !!nodeAddress && (!!quotedProgram || customProviders.length > 0) && cost > 0,
    staleTime: USAGE_STALE_TIME,
    queryFn: () =>
      quoteSubsidy({
        cost,
        customProviders,
        jobType,
        nodeAddress: nodeAddress!,
        payer: account.address!,
        program: quotedProgram,
      }),
  });
};

/** Whether the wallet can use the ON subsidy or any custom one. */
export const useHasSubsidy = () => {
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();
  const { addresses: customProviders } = useActiveCustomSubsidies();
  return (!!program && !!usage?.userAllowed) || customProviders.length > 0;
};

export const useSubsidyHistory = () => {
  const { data: program } = useSubsidyProgram();
  const { data: customAddresses } = useCustomSubsidyAddresses();
  const hasSubsidy = useHasSubsidy();
  const { data: events, isError, isLoading } = usePayerEscrowEvents({ enabled: hasSubsidy });
  const history = useMemo(
    () => (events ? buildSubsidyHistory(program ?? null, customAddresses ?? [], groupLockCycles(events)) : undefined),
    [customAddresses, events, program]
  );

  return { data: history, isError, isLoading };
};

/** What the payer locks when the job starts: `cost` minus the prepaid part of the subsidy quote. */
export const usePayerCost = (params: Parameters<typeof useSubsidyQuote>[0]) => {
  const { isLoading: isProgramLoading } = useSubsidyProgram();
  const { isLoading: isUsageLoading } = useSubsidyUsage();
  const { isLoading: isCustomLoading } = useActiveCustomSubsidies();
  const { data: quote, isFetching } = useSubsidyQuote(params);
  return {
    isQuoting: isProgramLoading || isUsageLoading || isCustomLoading || isFetching,
    payerCost: getUpfrontCost(params.cost, quote),
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

/**
 * Runs a paid start or prolong. It quotes the subsidy and passes the providers to `start` (`undefined` leaves the
 * choice to the node). Once the node's reply is checked, it records the payment in PostHog (see payment-analytics).
 * The result is returned as is, even when the reply isn't a job.
 */
export const useStartWithSubsidy = () => {
  const invalidateSubsidyData = useInvalidateSubsidyData();
  return useCallback(
    async <T>(
      context: PaidStartContext,
      start: (subsidyProviders: string[] | undefined) => Promise<T>,
      parseReply: (result: unknown) => PaymentReply
    ): Promise<T> => {
      const subsidy = await resolveJobSubsidy({
        cost: context.cost,
        jobType: context.jobType,
        nodeAddress: context.nodeAddress,
        payer: context.payer,
      });
      try {
        const result = await startWithSubsidy(async () => {
          try {
            return await start(subsidy.providers);
          } catch (error) {
            // Captured before startWithSubsidy swaps a shortfall revert for a readable message.
            capturePaymentFailed(context, subsidy, error, 'node_call');
            throw error;
          }
        });
        const reply = safeParseReply(parseReply, result);
        if (reply.valid) {
          capturePaymentAccepted(context, subsidy, reply);
        } else {
          capturePaymentFailed(context, subsidy, new Error(reply.reason), 'invalid_reply');
        }
        return result;
      } finally {
        invalidateSubsidyData();
      }
    },
    [invalidateSubsidyData]
  );
};
