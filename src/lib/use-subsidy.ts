import { CHAIN_ID } from '@/constants/chains';
import { groupLockCycles } from '@/lib/escrow-events';
import {
  buildSubsidyHistory,
  getSubsidyJobTypeName,
  isNodeSubsidized,
  loadSubsidyProgram,
  loadSubsidyUsage,
  quoteSubsidy,
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

/** `null` when no prepaid provider is configured. */
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
  /** `null` when the contract can't prepay jobs in USDC. */
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
      posthog.capture('subsidy_custom_added');
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
      posthog.capture('subsidy_custom_removed');
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

/** Whether the wallet can use the OPF subsidy or any custom one. */
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

/** `cost` minus the subsidy quote. */
export const usePayerCost = (params: Parameters<typeof useSubsidyQuote>[0]) => {
  const { isLoading: isProgramLoading } = useSubsidyProgram();
  const { isLoading: isUsageLoading } = useSubsidyUsage();
  const { isLoading: isCustomLoading } = useActiveCustomSubsidies();
  const { data: quote, isFetching } = useSubsidyQuote(params);
  return {
    isQuoting: isProgramLoading || isUsageLoading || isCustomLoading || isFetching,
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
