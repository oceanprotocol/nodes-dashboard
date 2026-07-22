import { ResourceSizing } from '@/components/hooks/use-inference-allocation';
import { getApiRoute } from '@/config';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { withTimeout } from '@/lib/with-timeout';
import { NodeEnvironments } from '@/types/environments';
import { InferencePackage } from '@/types/inference';
import { getEnvSupportedTokens } from '@/utils/env-tokens';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Cap the environments lookup so a hung indexer can't keep the package modal on "loading" forever.
const ENV_FETCH_TIMEOUT_MS = 30000;

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

/**
 * Resolve the live environment a package pins. The package stores only ids (peer + env prefix + GPU
 * selection); this fetches the node's environments and rebuilds the SelectedInferenceEnv the custom
 * flow commits, so the payment page prices/escrows/launches against the real env. Matches the env by
 * its stable id prefix (the suffix rotates per epoch), like inference-context's URL hydration. Token
 * isn't pinned — seeded here, switchable in the modal's env card.
 */
const usePackageEnv = (pkg: InferencePackage | null) => {
  const [resolved, setResolved] = useState<ResolvedPackageEnv | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchEpoch, setFetchEpoch] = useState(0);

  useEffect(() => {
    if (!pkg) {
      setResolved(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    // Aborts the in-flight request on effect re-run / unmount (modal closed, package switched), on top
    // of withTimeout — so a hung indexer can't keep the modal spinning after the user moved on.
    const cleanupController = new AbortController();
    const { peerId, envIdPrefix, gpuSelection } = pkg.env;
    const sizing = recommendedSizing(pkg);

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved(null);
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
        const envs = node?.computeEnvironments.environments ?? [];
        const environment = envs.find((env) => env.id.split('-')[0] === envIdPrefix);
        if (!node || !environment) {
          throw new Error('The environment for this package is not reachable right now.');
        }
        const tokenAddress = pickDefaultToken(getEnvSupportedTokens(environment, true));
        let symbol: string | null = null;
        if (tokenAddress) {
          try {
            symbol = await getTokenSymbol(tokenAddress);
          } catch (error) {
            console.error('Failed to resolve package token symbol:', error);
          }
        }
        if (!cancelled) {
          setResolved({
            env: {
              environment,
              gpuSelection,
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
          });
        }
      } catch (error) {
        console.error('Failed to resolve package environment:', error);
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to resolve the environment.');
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

export default usePackageEnv;
