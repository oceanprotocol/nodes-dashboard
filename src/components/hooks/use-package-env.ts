import { getApiRoute } from '@/config';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { getTokenSymbol } from '@/lib/token-symbol';
import { NodeEnvironments } from '@/types/environments';
import { InferencePackage } from '@/types/inference';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

export type ResolvedPackageEnv = {
  env: SelectedInferenceEnv;
  token: SelectedToken;
};

/**
 * Resolve the live environment a package pins. The package stores only ids (peer + env prefix +
 * per-type GPU selection + token); this fetches the node's environments and rebuilds the same
 * SelectedInferenceEnv shape the custom flow commits — so the payment page prices, escrows and
 * launches against the real env. Mirrors the env restore in inference-context's URL hydration:
 * match the env by its stable id prefix (the suffix rotates per epoch).
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
    const { peerId, envIdPrefix, gpuSelection, tokenAddress } = pkg.env;

    async function resolve() {
      setLoading(true);
      setLoadError(null);
      setResolved(null);
      try {
        const response = await axios.get<{ envs: NodeEnvironments[] }>(getApiRoute('environments'), {
          params: {
            filters: JSON.stringify({ id: { operator: 'eq', value: peerId } }),
            size: 1000,
          },
        });
        const node = response.data.envs.find((n) => n.id === peerId);
        const envs = node?.computeEnvironments.environments ?? [];
        const environment = envs.find((env) => env.id.split('-')[0] === envIdPrefix);
        if (!node || !environment) {
          throw new Error('The environment for this package is not reachable right now.');
        }
        let symbol: string | null = null;
        try {
          symbol = await getTokenSymbol(tokenAddress);
        } catch (error) {
          console.error('Failed to resolve package token symbol:', error);
        }
        if (!cancelled) {
          setResolved({
            env: {
              environment,
              gpuSelection,
              nodeInfo: {
                currentAddrs: node.currentAddrs,
                friendlyName: node.friendlyName,
                id: node.id,
                latestBenchmarkResults: node.latestBenchmarkResults,
                multiaddrs: node.multiaddrs,
              },
            },
            token: { address: tokenAddress, symbol: symbol ?? '' },
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
    };
  }, [pkg, fetchEpoch]);

  const retry = useCallback(() => {
    setFetchEpoch((epoch) => epoch + 1);
  }, []);

  return { resolved, loading, loadError, retry };
};

export default usePackageEnv;
