import { ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { withTimeout } from '@/lib/with-timeout';
import { ComputeEnvironment, ComputeResource, NodeEnvironments } from '@/types/environments';
import { InferencePackage, ResourceRequirement } from '@/types/inference';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
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

// Quick start pins each package's recommended CPU/RAM/disk (fixed, not GPU-fraction-derived).
// GPU is handled separately by gpuSelection. Missing/omitted resources fall back to 0 → the
// allocation hook then floors them at the env's own min.
function recommendedSizing(pkg: InferencePackage): ResourceSizing {
  const amount = (id: string) => pkg.requiredResources.find((r) => r.id === id)?.recommended ?? 0;
  return { mode: 'pinned', cpu: amount('cpu'), ram: amount('ram'), disk: amount('disk') };
}

// Seed fee token: USDC when accepted, else first supported paid token. Mirrors the modal env card's
// getDefaultToken so both agree on the seed before the user switches it there.
function pickDefaultToken(supportedTokens: string[]): string | null {
  const usdc = getSupportedTokens().USDC.address;
  if (supportedTokens.some((t) => t.toLowerCase() === usdc.toLowerCase())) {
    return usdc;
  }
  return supportedTokens[0] ?? null;
}

// Units of a fungible/GPU resource the env can hand ONE job right now: min(total, max) − inUse,
// mirroring the allocation hook's grantableAmount. Used to test a package's resource floor.
function grantable(resource: Pick<ComputeResource, 'total' | 'max' | 'inUse'>): number {
  const max = resource.max ?? 0;
  const total = resource.total && resource.total > 0 ? resource.total : max;
  return Math.max(0, Math.min(total, max) - (resource.inUse ?? 0));
}

// Sum grantable units across every resource of a `type` (e.g. all GPUs).
function grantableByType(environment: ComputeEnvironment, type: string): number {
  return (environment.resources ?? [])
    .filter((r) => r.type === type)
    .reduce((sum, r) => sum + grantable(r), 0);
}

// Grantable amount for a single continuous resource by id (cpu/ram/disk).
function grantableById(environment: ComputeEnvironment, id: string): number {
  const resource = (environment.resources ?? []).find((r) => r.id === id);
  return resource ? grantable(resource) : 0;
}

/**
 * Whether an env can currently satisfy every `requiredResources` floor (`min`). GPU requirements
 * (`type: 'gpu'`) are summed across all GPU resources; cpu/ram/disk are matched by id. An env that
 * can't meet a floor is hidden from the modal — it can't launch the package.
 */
function meetsMinResources(environment: ComputeEnvironment, required: ResourceRequirement[]): boolean {
  return required.every((req) => {
    const available = req.type === 'gpu' ? grantableByType(environment, 'gpu') : grantableById(environment, req.id);
    return available >= req.min;
  });
}

/**
 * Auto GPU selection for a read-only card: book the recommended GPU count when the env has that many
 * units free, else fall back to the package's min (guaranteed by meetsMinResources). Keyed by GPU
 * `description` (what the allocation hook/buildGpuRequests match on). Empty for a GPU-less package.
 */
function autoGpuSelection(
  environment: ComputeEnvironment,
  required: ResourceRequirement[]
): Record<string, number> {
  const gpuReq = required.find((r) => r.type === 'gpu');
  if (!gpuReq) {
    return {};
  }
  const selection: Record<string, number> = {};
  let remaining = Math.min(gpuReq.recommended, grantableByType(environment, 'gpu'));
  // Draw the target across GPU types in declared order (units free per type), each keyed by its
  // description so units of one type merge under one key.
  (environment.resources ?? [])
    .filter((r) => r.type === 'gpu')
    .forEach((r) => {
      if (remaining <= 0) {
        return;
      }
      const key = r.description || 'GPU';
      const take = Math.min(grantable(r), remaining);
      selection[key] = (selection[key] ?? 0) + take;
      remaining -= take;
    });
  return selection;
}

/**
 * Resolve the environments a package can run on. The package carries only its source node's peer id;
 * this fetches that node's environments, keeps the ones that (a) advertise service-on-demand, (b)
 * accept a supported paid token (USDC/COMPY), and (c) can currently satisfy the package's resource
 * floors, then rebuilds a bookable SelectedInferenceEnv for each (recommended sizing + auto GPU
 * selection + seeded token). The modal renders one card + Continue per entry.
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
    const peerId = pkg.sourcePeerId;
    const sizing = recommendedSizing(pkg);

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved([]);
      try {
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
          throw new Error('The node for this package is not reachable right now.');
        }
        // Keep only envs that can run the package: service-on-demand + a supported paid token + the
        // package's resource floors.
        const candidates = (node.computeEnvironments.environments ?? []).filter((environment) => {
          if (!environment.features?.services) {
            return false;
          }
          if (getEnvSupportedTokens(environment, true).length === 0) {
            return false;
          }
          return meetsMinResources(environment, pkg!.requiredResources);
        });

        const entries = await Promise.all(
          candidates.map(async (environment): Promise<ResolvedPackageEnv> => {
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
