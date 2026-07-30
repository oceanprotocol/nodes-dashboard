import { ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { getApiRoute } from '@/config';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { withTimeout } from '@/lib/with-timeout';
import { NodeEnvironments } from '@/types/environments';
import { InferencePackage } from '@/types/inference';
import { autoGpuSelection, meetsMinResources } from '@/utils/env-resources';
import { getEnvSupportedTokens, pickDefaultToken } from '@/utils/env-tokens';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Cap the environments lookup so a hung indexer can't keep the package modal on "loading" forever.
const ENV_FETCH_TIMEOUT_MS = 30000;

/** One environment of the package's source node, resolved and ready to book (recommended sizing +
 *  auto GPU selection + seeded fee token). The modal renders one card + Continue per entry. */
export type ResolvedPackageEnv = {
  env: SelectedInferenceEnv;
  /** Seeded fee token (USDC else first supported); null if the env accepts no supported paid token. */
  token: SelectedToken | null;
};

// Quick start pins each package's recommended CPU/RAM/disk (fixed, not GPU-fraction-derived), floored
// at the package's per-resource min so the effective lower bound is max(envMin, packageMin) — a
// constraint ceiling can't trim the booked amount below what the model needs. GPU is handled separately
// by gpuSelection. Missing/omitted resources fall back to 0 → the allocation hook then floors them at
// the env's own min.
function recommendedSizing(pkg: InferencePackage): ResourceSizing {
  const req = (id: string) => pkg.requiredResources.find((r) => r.id === id);
  const recommended = (id: string) => req(id)?.recommended ?? 0;
  const min = (id: string) => req(id)?.min ?? 0;
  return {
    mode: 'pinned',
    cpu: recommended('cpu'),
    ram: recommended('ram'),
    disk: recommended('disk'),
    floor: { cpu: min('cpu'), ram: min('ram'), disk: min('disk') },
  };
}

/**
 * Resolve the environments a package can run on. The package carries only its source nodes' peer ids;
 * this fetches those nodes' environments, keeps the ones that (a) advertise service-on-demand, (b)
 * accept a supported paid token (USDC/COMPY), and (c) can currently satisfy the package's resource
 * floors, then rebuilds a bookable SelectedInferenceEnv for each (recommended sizing + auto GPU
 * selection + seeded token). The modal renders one card + Continue per entry, across all nodes.
 * Only when EVERY listed node is unreachable does this surface an error.
 */
const usePackageEnvs = (pkg: InferencePackage | null) => {
  const [resolved, setResolved] = useState<ResolvedPackageEnv[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchEpoch, setFetchEpoch] = useState(0);

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
    const peerIds = Array.from(new Set(pkg.sourcePeerIds ?? []));
    const sizing = recommendedSizing(pkg);

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
                    filters: JSON.stringify({ id: { operator: 'eq', value: peerId } }),
                    size: 1000,
                  },
                  // Abort on whichever fires first: the timeout, or effect cleanup.
                  signal: AbortSignal.any([timeoutSignal, cleanupController.signal]),
                }),
              ENV_FETCH_TIMEOUT_MS,
              'Package environment lookup'
            );
            const node = response.data.envs.find((n) => n.id === peerId);
            if (!node) {
              throw new Error(`Node ${peerId} is not reachable right now.`);
            }
            return node;
          })
        );

        const nodes = nodeResults
          .filter((result): result is PromiseFulfilledResult<NodeEnvironments> => result.status === 'fulfilled')
          .map((result) => result.value);

        nodeResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed to fetch environments from ${peerIds[index]}:`, result.reason);
          }
        });

        // Error only when nothing came back at all — a partial result still gives the user something
        // bookable.
        if (nodes.length === 0) {
          throw new Error('The nodes for this package are not reachable right now.');
        }

        // Keep only envs that can run the package: service-on-demand + a supported paid token + the
        // package's resource floors. Flattened across nodes, each env keeping its own node.
        const candidates = nodes.flatMap((node) =>
          (node.computeEnvironments.environments ?? [])
            .filter((environment) => {
              if (!environment.features?.services) {
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
                gpuSelection: autoGpuSelection(environment, pkg!.requiredResources),
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
        }
      } catch (error) {
        console.error('Failed to resolve package environments:', error);
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
  }, [pkg, fetchEpoch]);

  const retry = useCallback(() => {
    setFetchEpoch((epoch) => epoch + 1);
  }, []);

  return { resolved, loading, loadError, retry };
};

export default usePackageEnvs;
