import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { templatePinnedSizing } from '@/services/template-launch';
import { withTimeout } from '@/lib/with-timeout';
import { ApiPaginationResponse } from '@/types/api';
import { ComputeEnvironment, NodeEnvironments } from '@/types/environments';
import { AppTemplate } from '@/types/templates';
import { autoGpuSelection, isBenchmarkEnv, meetsMinResources } from '@/utils/env-resources';
import { getEnvSupportedTokens, pickDefaultToken } from '@/utils/env-tokens';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Cap the environments lookup so a hung indexer can't keep the details modal on "loading" forever.
const ENV_FETCH_TIMEOUT_MS = 30000;
// One page, ranked by benchmark score — the modal shows the best matches, not the whole network. The
// resources step (Advanced setup) is the exhaustive, paginated picker.
const ENV_PAGE_SIZE = 100;
/** Env cards rendered in the modal. Above this, the modal says so and points at Advanced setup. */
export const TEMPLATE_ENV_DISPLAY_LIMIT = 8;

/** One environment that can run the template, resolved and ready to book (pinned sizing + auto GPU
 *  selection + seeded fee token). The modal renders one card + Continue per entry. */
export type ResolvedTemplateEnv = {
  env: SelectedInferenceEnv;
  /** Seeded fee token (USDC else first supported); null if the env accepts no supported paid token. */
  token: SelectedToken | null;
};

export type TemplateEnvsState = {
  /** Best-ranked environments that can run the template, capped at {@link TEMPLATE_ENV_DISPLAY_LIMIT}. */
  resolved: ResolvedTemplateEnv[];
  /** How many matched in total — greater than `resolved.length` when the display cap kicked in. */
  totalMatched: number;
  loading: boolean;
  loadError: string | null;
  retry: () => void;
};

/** An env can host a template when it advertises service-on-demand, isn't the node's benchmark env,
 *  accepts a supported paid token, and can currently satisfy the template's declared resource floors. */
function canRunTemplate(environment: ComputeEnvironment, template: AppTemplate): boolean {
  if (!environment.features?.services) {
    return false;
  }
  if (isBenchmarkEnv(environment)) {
    return false;
  }
  if (getEnvSupportedTokens(environment, true).length === 0) {
    return false;
  }
  return meetsMinResources(environment, template.requiredResources ?? []);
}

/**
 * Resolve the environments a template can launch on, across every node the indexer knows — unlike a
 * quick-start package (pinned to its source nodes), a template is just an image, so any service-capable
 * environment that meets its floors can run it. Fetches one benchmark-ranked page, keeps the envs that
 * qualify, and rebuilds a bookable SelectedInferenceEnv for each (pinned sizing + auto GPU selection +
 * seeded token). Null template → idle.
 */
const useTemplateEnvs = (template: AppTemplate | null): TemplateEnvsState => {
  const [resolved, setResolved] = useState<ResolvedTemplateEnv[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchEpoch, setFetchEpoch] = useState(0);

  useEffect(() => {
    if (!template) {
      setResolved([]);
      setTotalMatched(0);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    // Aborts the in-flight request on effect re-run / unmount (modal closed, template switched), on top
    // of withTimeout — so a hung indexer can't keep the modal spinning after the user moved on.
    const cleanupController = new AbortController();
    const sizing = templatePinnedSizing(template);

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved([]);
      setTotalMatched(0);
      try {
        const response = await withTimeout(
          (timeoutSignal) =>
            axios.get<{ envs: NodeEnvironments[]; pagination: ApiPaginationResponse }>(getApiRoute('environments'), {
              params: {
                filters: JSON.stringify({
                  network: { operator: 'eq', value: String(CHAIN_ID) },
                  feeToken: { operator: 'in', value: Object.values(getSupportedTokens()).map((t) => t.address) },
                }),
                page: 1,
                pageSize: ENV_PAGE_SIZE,
                sort: JSON.stringify({ benchmarkTotalScore: 'desc' }),
              },
              // Abort on whichever fires first: the timeout, or effect cleanup.
              signal: AbortSignal.any([timeoutSignal, cleanupController.signal]),
            }),
          ENV_FETCH_TIMEOUT_MS,
          'Template environment lookup'
        );

        const candidates = (response.data.envs ?? []).flatMap((node) =>
          (node.computeEnvironments.environments ?? [])
            .filter((environment) => canRunTemplate(environment, template!))
            .map((environment) => ({ node, environment }))
        );

        const entries = await Promise.all(
          candidates.slice(0, TEMPLATE_ENV_DISPLAY_LIMIT).map(async ({ node, environment }): Promise<ResolvedTemplateEnv> => {
            const tokenAddress = pickDefaultToken(getEnvSupportedTokens(environment, true));
            let symbol: string | null = null;
            if (tokenAddress) {
              try {
                symbol = await getTokenSymbol(tokenAddress);
              } catch (error) {
                console.error('Failed to resolve template fee token symbol:', error);
              }
            }
            return {
              env: {
                environment,
                gpuSelection: autoGpuSelection(environment, template!.requiredResources ?? []),
                sizing,
                nodeInfo: {
                  currentAddrs: node.currentAddrs,
                  friendlyName: node.friendlyName,
                  id: node.id,
                  latestBenchmarkResults: node.latestBenchmarkResults,
                  multiaddrs: node.multiaddrs,
                },
              },
              token: tokenAddress ? { address: tokenAddress, symbol: symbol ?? '' } : null,
            };
          })
        );

        if (!cancelled) {
          setResolved(entries);
          setTotalMatched(candidates.length);
        }
      } catch (error) {
        console.error('Failed to resolve template environments:', error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to resolve the environments.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
      cleanupController.abort();
    };
  }, [template, fetchEpoch]);

  const retry = useCallback(() => {
    setFetchEpoch((epoch) => epoch + 1);
  }, []);

  return { resolved, totalMatched, loading, loadError, retry };
};

export default useTemplateEnvs;
