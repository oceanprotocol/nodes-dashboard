import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { isInferenceNode } from '@/constants/nodes';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { withTimeout } from '@/lib/with-timeout';
import { recommendedSizing } from '@/services/quick-start';
import { ApiPaginationResponse } from '@/types/api';
import { ComputeEnvironment, NodeEnvironments } from '@/types/environments';
import { AppTemplate } from '@/types/templates';
import { autoGpuSelection, isBenchmarkEnv, meetsMinResources } from '@/utils/env-resources';
import { getEnvSupportedTokens, pickDefaultToken } from '@/utils/env-tokens';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Cap the environments lookup so a hung indexer can't keep the details modal on "loading" forever.
const ENV_FETCH_TIMEOUT_MS = 30000;
// One page holding every row, then narrowed client-side to the inference allowlist. `/envs` has no
// node-id filter (see the FilterField switch in incentive-backend `getEnvs`), so a small
// benchmark-ranked page could rank the allowlisted nodes off the end and leave the modal empty —
// the same reason use-package-env and inference-context's `restoreEnv` over-fetch.
const ENV_PAGE_SIZE = 1000;

/** One environment that can run the template, resolved and ready to book (recommended sizing + auto GPU
 *  selection + seeded fee token). The modal's quick start picks one of these entries to launch on. */
export type ResolvedTemplateEnv = {
  env: SelectedInferenceEnv;
  /** Seeded fee token (USDC else first supported); null if the env accepts no supported paid token. */
  token: SelectedToken | null;
};

export type TemplateEnvsState = {
  /**
   * Every environment that can run the template, benchmark-ranked. Uncapped: nothing lists them any
   * more: the quick start ranks all of them (verified, then price, then score) and picks one, and
   * Advanced setup has its own full picker.
   */
  resolved: ResolvedTemplateEnv[];
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
 * qualify, and rebuilds a bookable SelectedInferenceEnv for each (recommended sizing + auto GPU selection +
 * seeded token). Null template → idle.
 */
const useTemplateEnvs = (template: AppTemplate | null): TemplateEnvsState => {
  const [resolved, setResolved] = useState<ResolvedTemplateEnv[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchEpoch, setFetchEpoch] = useState(0);
  // The template the last lookup settled for. Until the effect has started one for a new template, `loading`
  // alone still reads false with nothing resolved, which the quick start would show as "nothing fits".
  const [settledFor, setSettledFor] = useState<AppTemplate | null>(null);

  useEffect(() => {
    if (!template) {
      setResolved([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    // Aborts the in-flight request on effect re-run / unmount (modal closed, template switched), on top
    // of withTimeout — so a hung indexer can't keep the modal spinning after the user moved on.
    const cleanupController = new AbortController();
    const sizing = recommendedSizing(template.requiredResources);

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved([]);
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

        const candidates = (response.data.envs ?? [])
          // Inference launches only on the allowlisted nodes — see ON_INFERENCE_NODES.
          // TODO: remove this allowlist once community nodes are allowed to run inference services.
          // Drop this `.filter` and put ENV_PAGE_SIZE back to a modest page — the over-fetch exists
          // only so the allowlisted nodes can't rank off the end of a small benchmark-sorted page.
          .filter((node) => isInferenceNode(node.id))
          .flatMap((node) =>
            (node.computeEnvironments.environments ?? [])
              .filter((environment) => canRunTemplate(environment, template!))
              .map((environment) => ({ node, environment }))
          );

        const entries = await Promise.all(
          candidates.map(async ({ node, environment }): Promise<ResolvedTemplateEnv> => {
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
                // Prefer recommendedResources for the GPU COUNT (null on every live template today,
                // but this stays right if that changes) — meetsMinResources above stays on
                // requiredResources since that's the actual floor, not the recommendation. The shared
                // CPU/RAM/disk are sized separately by recommendedSizing: the recommended amounts,
                // floored at the required mins.
                // Templates are one of the two zero-GPU-permitting flows (see env-resources.ts spec) — a
                // template declaring no GPU requirement (jupyterlab, hermes) must seed 0 rather than the
                // old blanket "nothing declared -> 1", on an env whose GPU min actually allows it.
                gpuSelection: autoGpuSelection({
                  environment,
                  required: template!.recommendedResources ?? template!.requiredResources ?? [],
                  allowZeroGpu: true,
                }),
                sizing,
                nodeInfo: {
                  currentAddrs: node.currentAddrs,
                  friendlyName: node.friendlyName,
                  id: node.id,
                  latestBenchmarkResults: node.latestBenchmarkResults,
                  multiaddrs: node.multiaddrs,
                  // Quick start prefers verified nodes when several can host the template.
                  verified: node.verified,
                },
              },
              token: tokenAddress ? { address: tokenAddress, symbol: symbol ?? '' } : null,
            };
          })
        );

        if (!cancelled) {
          setResolved(entries);
        }
      } catch (error) {
        // A cancelled lookup (modal closed, template switched, or the effect re-run) is not a failure.
        if (!cancelled) {
          console.error('Failed to resolve template environments:', error);
          setLoadError(error instanceof Error ? error.message : 'Failed to resolve the environments.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSettledFor(template);
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

  return { resolved, loading: loading || (!!template && settledFor !== template), loadError, retry };
};

export default useTemplateEnvs;
