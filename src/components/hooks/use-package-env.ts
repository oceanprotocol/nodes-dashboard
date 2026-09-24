import { ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { isInferenceNode } from '@/constants/nodes';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { withTimeout } from '@/lib/with-timeout';
import { recommendedSizing } from '@/services/quick-start';
import { NodeEnvironments } from '@/types/environments';
import { InferencePackage } from '@/types/inference';
import { autoGpuSelection, isBenchmarkEnv, meetsMinResources } from '@/utils/env-resources';
import { getEnvSupportedTokens, pickDefaultToken } from '@/utils/env-tokens';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Cap the environments lookup so a hung indexer can't keep the package modal on "loading" forever.
const ENV_FETCH_TIMEOUT_MS = 30000;

/** One environment of the package's source node, resolved and ready to book (recommended sizing + auto GPU
 *  selection + seeded fee token). The modal's quick start picks one of these entries to launch on. */
export type ResolvedPackageEnv = {
  env: SelectedInferenceEnv;
  /** Seeded fee token (USDC else first supported); null if the env accepts no supported paid token. */
  token: SelectedToken | null;
};

/**
 * The package's per-resource MIN (cpu/ram/disk) as a floor under the GPU-fraction slice, the same
 * `floor` sizing templates use (templateFloorSizing). Used by the advanced handoff, where it floors the
 * custom flow's slice. The quick start books the package's recommended amounts instead (recommendedSizing).
 */
export function packageFloorSizing(pkg: InferencePackage): ResourceSizing {
  const min = (id: string) => pkg.requiredResources.find((r) => r.id === id)?.min ?? 0;
  return { mode: 'floor', cpu: min('cpu'), ram: min('ram'), disk: min('disk') };
}

/**
 * Resolve the environments a package can run on. The package carries only its source nodes' peer ids;
 * this fetches those nodes' environments, keeps the ones that (a) advertise service-on-demand, (b)
 * accept a supported paid token (USDC/COMPY), and (c) can currently satisfy the package's resource
 * floors, then rebuilds a bookable SelectedInferenceEnv for each (recommended sizing + auto GPU selection +
 * seeded token), across all nodes. The modal's quick start ranks them and launches on the best fit.
 * Only when EVERY listed node is unreachable does this surface an error.
 */
const usePackageEnvs = (pkg: InferencePackage | null) => {
  const [resolved, setResolved] = useState<ResolvedPackageEnv[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchEpoch, setFetchEpoch] = useState(0);
  // The pkg the last lookup settled for. Until the effect has started one for a new pkg, `loading`
  // alone still reads false with nothing resolved, which the quick start would show as "nothing fits".
  const [settledFor, setSettledFor] = useState<InferencePackage | null>(null);

  useEffect(() => {
    if (!pkg) {
      setResolved([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    // Aborts the in-flight request on effect re-run / unmount (modal closed, package switched), on top
    // of withTimeout — so a hung indexer can't keep the modal spinning after the user moved on.
    const cleanupController = new AbortController();
    // The package names its own source nodes, but only the allowlisted ones may be launched on — a
    // package seeded from a node that has since dropped off ON_INFERENCE_NODES must offer nothing
    // rather than an env whose booking fails after payment.
    // TODO: remove this allowlist once community nodes are allowed to run inference services. Drop
    // the `.filter` — `sourcePeerIds` is then the only scope, which is what a package already means.
    const peerIds = Array.from(new Set(pkg.sourcePeerIds ?? [])).filter(isInferenceNode);
    const sizing = recommendedSizing(pkg.requiredResources);

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved([]);
      try {
        // One lookup per source node, isolated: an unreachable node contributes nothing instead of
        // dropping the envs of the nodes that did answer.
        const nodeResults = await Promise.allSettled(
          peerIds.map(async (peerId) => {
            const response = await withTimeout(
              (timeoutSignal) =>
                axios.get<{ envs: NodeEnvironments[] }>(getApiRoute('environments'), {
                  params: {
                    filters: JSON.stringify({
                      id: { operator: 'eq', value: peerId },
                      network: { operator: 'eq', value: String(CHAIN_ID) },
                    }),
                    size: 1000,
                  },
                  // Abort on whichever fires first: the timeout, or effect cleanup.
                  signal: AbortSignal.any([timeoutSignal, cleanupController.signal]),
                }),
              ENV_FETCH_TIMEOUT_MS,
              'Package environment lookup'
            );
            // `/envs` returns ONE row per environment, and every row of a node carries that node's
            // peer id. So all of the node's rows have to be kept: matching the peer id with `.find()`
            // returns row 0 alone, which offers the node's FIRST environment and hides every other —
            // on a node whose first row is an exhausted single-GPU env, that reads as "no environment
            // available for this package" while the picker (use-template-envs, which flatMaps) shows
            // the same node's real one. Same rule as inference-context's `restoreEnv`.
            const rows = response.data.envs.filter((n) => n.id === peerId);
            if (rows.length === 0) {
              throw new Error(`Node ${peerId} is not reachable right now.`);
            }
            return rows;
          })
        );

        const nodes = nodeResults
          .filter((result): result is PromiseFulfilledResult<NodeEnvironments[]> => result.status === 'fulfilled')
          .flatMap((result) => result.value);

        nodeResults.forEach((result, index) => {
          // Skipped once cancelled: every lookup then rejects with the abort, which is no failure.
          if (result.status === 'rejected' && !cancelled) {
            console.error(`Failed to fetch environments from ${peerIds[index]}:`, result.reason);
          }
        });

        // Error only when nothing came back at all — a partial result still gives the user something
        // bookable. Also covers an allowlist that filtered every source node out.
        if (nodes.length === 0) {
          throw new Error('The nodes for this package are not reachable right now.');
        }

        // Keep only envs that can run the package: service-on-demand + a supported paid token + the
        // package's resource floors. Flattened across every row of every node (one env per row), each
        // env keeping its own node.
        const candidates = nodes.flatMap((node) =>
          (node.computeEnvironments.environments ?? [])
            .filter((environment) => {
              // `/envs` ignores the `id` filter sent above (no node-id case in `getEnvs`), so the
              // node identity is re-checked here rather than trusted from the query.
              // TODO: remove this allowlist once community nodes are allowed to run inference
              // services. This guard goes with it; the per-peerId lookup above already scopes the node.
              if (!isInferenceNode(node.id)) {
                return false;
              }
              if (!environment.features?.services) {
                return false;
              }
              if (isBenchmarkEnv(environment)) {
                return false;
              }
              if (getEnvSupportedTokens(environment, true).length === 0) {
                return false;
              }
              return meetsMinResources(environment, pkg!.requiredResources);
            })
            .map((environment) => ({ node, environment }))
        );

        const entries = await Promise.all(
          candidates.map(async ({ node, environment }): Promise<ResolvedPackageEnv> => {
            const tokenAddress = pickDefaultToken(getEnvSupportedTokens(environment, true));
            let symbol: string | null = null;
            if (tokenAddress) {
              try {
                symbol = await getTokenSymbol(tokenAddress);
              } catch (error) {
                console.error('Failed to resolve package token symbol:', error);
              }
            }
            return {
              env: {
                environment,
                // Packages never permit a zero-GPU pick (allowZeroGpu defaults false) — see the card prop.
                gpuSelection: autoGpuSelection({ environment, required: pkg!.requiredResources }),
                sizing,
                nodeInfo: {
                  currentAddrs: node.currentAddrs,
                  friendlyName: node.friendlyName,
                  id: node.id,
                  latestBenchmarkResults: node.latestBenchmarkResults,
                  multiaddrs: node.multiaddrs,
                  // Quick start prefers verified nodes when several can host the package.
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
        // A cancelled lookup (modal closed, package switched, or the effect re-run) is not a failure.
        if (!cancelled) {
          console.error('Failed to resolve package environments:', error);
          setLoadError(error instanceof Error ? error.message : 'Failed to resolve the environments.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSettledFor(pkg);
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
      cleanupController.abort();
    };
  }, [pkg, fetchEpoch]);

  const retry = useCallback(() => {
    setFetchEpoch((epoch) => epoch + 1);
  }, []);

  return { resolved, loading: loading || (!!pkg && settledFor !== pkg), loadError, retry };
};

export default usePackageEnvs;
