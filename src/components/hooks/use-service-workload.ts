import { useNodeTokensContext } from '@/context/node-tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { serviceWorkload, SubsidyWorkload } from '@/lib/subsidy';
import { withTimeout } from '@/lib/with-timeout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const STALE_TIME = 30_000;
const STATUS_TIMEOUT_MS = 15_000;

type ServiceWorkloadState = {
  /** Reads the workload even when that asks for a signature. Resolves with `null` when it can't be read. */
  load: () => Promise<SubsidyWorkload | null>;
  /** `undefined` while it loads, `null` when it can't be read or there is no service. */
  workload: SubsidyWorkload | null | undefined;
};

/**
 * What a running service runs, read from the node. The node checks an extension's subsidy against the spec the
 * service was started with, which the selection a page rebuilds may no longer match.
 * It is only read up front when that doesn't ask for a signature.
 */
export function useServiceWorkload({
  nodeId,
  nodeUri,
  serviceId,
}: {
  nodeId: string | undefined;
  nodeUri: NodeUri | undefined;
  serviceId: string | undefined;
}): ServiceWorkloadState {
  const { getServiceStatus, isReady } = useP2P();
  const { hasValidNodeToken, withNodeAuth } = useNodeTokensContext();
  const queryClient = useQueryClient();
  const hasService = !!nodeId && !!nodeUri && !!serviceId;
  const hasToken = !!nodeId && hasValidNodeToken(nodeId);

  const query = useMemo(
    () => ({
      queryKey: ['service-workload', nodeId, serviceId],
      staleTime: STALE_TIME,
      queryFn: async (): Promise<SubsidyWorkload> => {
        const [job] = await withNodeAuth(nodeId!, nodeUri!, (token) =>
          withTimeout(
            (signal) => getServiceStatus(nodeUri!, token, serviceId, signal),
            STATUS_TIMEOUT_MS,
            'Service status'
          )
        );
        if (!job) {
          throw new Error('Service not found');
        }
        return serviceWorkload(job);
      },
    }),
    [getServiceStatus, nodeId, nodeUri, serviceId, withNodeAuth]
  );

  const { data, isError } = useQuery({ ...query, enabled: isReady && hasService && hasToken });

  const load = useCallback(async () => {
    if (!hasService) {
      return null;
    }
    try {
      return await queryClient.fetchQuery(query);
    } catch (error) {
      console.error('Failed to read the service workload', error);
      return null;
    }
  }, [hasService, query, queryClient]);

  return { load, workload: !hasService || !hasToken || isError ? null : data };
}
