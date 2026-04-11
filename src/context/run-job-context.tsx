import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { useP2P } from '@/contexts/P2PContext';
import { directNodeCommand } from '@/lib/direct-node-command';
import { getTokenDecimals, getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  ComputeEnvironment,
  EnvNodeInfo,
  EnvResourcesSelection,
  MultiaddrsOrPeerId,
  NodeEnvironments,
} from '@/types/environments';
import { roundTokenAmount } from '@/utils/formatters';
import { multiaddr } from '@multiformats/multiaddr';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { useSearchParams } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type SelectedToken = {
  symbol: string;
  address: string;
};

type RunJobContextType = {
  estimatedTotalCost: number | null;
  fetchEstimatedCost: ({
    environment,
    freeCompute,
    maxJobDurationSeconds,
    multiaddrsOrPeerId,
    onError,
    onSuccess,
    resources,
    tokenAddress,
  }: {
    environment: ComputeEnvironment;
    freeCompute: boolean;
    maxJobDurationSeconds: number;
    multiaddrsOrPeerId: MultiaddrsOrPeerId;
    onError?: (error: unknown) => void;
    onSuccess?: (cost: number, minLockSeconds: number) => void;
    resources: { id: string; amount: number }[];
    tokenAddress?: string;
  }) => Promise<void>;
  // fetchGpus: () => Promise<void>;
  freeCompute: boolean;
  // gpus: GPUPopularityDisplay;
  hydrateFromUrlFinished: boolean;
  minLockSeconds: number | null;
  multiaddrsOrPeerId: MultiaddrsOrPeerId | null;
  nodeInfo: EnvNodeInfo | null;
  selectedEnv: ComputeEnvironment | null;
  selectedResources: EnvResourcesSelection | null;
  selectedToken: SelectedToken | null;
  selectEnv: ({
    environment,
    freeCompute,
    nodeInfo,
    resources,
  }: {
    environment: ComputeEnvironment | null;
    freeCompute: boolean;
    nodeInfo: EnvNodeInfo;
    resources?: EnvResourcesSelection;
  }) => void;
  selectToken: (address: string, symbol?: string | null) => void | Promise<void>;
  setEstimatedTotalCost: (cost: number | null) => void;
  setMinLockSeconds: (seconds: number | null) => void;
  setSelectedResources: (selection: EnvResourcesSelection | null) => void;
};

const RunJobContext = createContext<RunJobContextType | undefined>(undefined);

export const RunJobProvider = ({ children }: { children: ReactNode }) => {
  const { provider } = useOceanAccount();
  const { initializeCompute, node: p2pNode } = useP2P();

  const searchParams = useSearchParams();
  const [estimatedTotalCost, setEstimatedTotalCost] = useState<number | null>(null);
  const [freeCompute, setFreeCompute] = useState<boolean>(false);
  // const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);
  const [hydrateFromUrlStarted, setHydrateFromUrlStarted] = useState(false);
  const [hydrateFromUrlFinished, setHydrateFromUrlFinished] = useState(false);
  const [nodeInfo, setNodeInfo] = useState<EnvNodeInfo | null>(null);
  const [minLockSeconds, setMinLockSeconds] = useState<number | null>(null);
  const [multiaddrsOrPeerId, setMultiaddrsOrPeerId] = useState<MultiaddrsOrPeerId | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<ComputeEnvironment | null>(null);
  const [selectedResources, setSelectedResources] = useState<EnvResourcesSelection | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);

  const clearRunJobSelection = useCallback(() => {
    setEstimatedTotalCost(null);
    setFreeCompute(false);
    setMinLockSeconds(null);
    setMultiaddrsOrPeerId(null);
    setNodeInfo(null);
    setSelectedEnv(null);
    setSelectedResources(null);
    setSelectedToken(null);
  }, []);

  // TODO fetch all GPUs not only top 5
  // const fetchGpus = useCallback(async () => {
  //   try {
  //     const response = await axios.get<GPUPopularityStats>(getApiRoute('gpuPopularity'));
  //     const res: GPUPopularityDisplay = response.data.map((gpu) => ({
  //       gpuName: `${gpu.vendor} ${gpu.name}`,
  //       popularity: gpu.popularity,
  //     }));
  //     setGpus(res);
  //   } catch (error) {
  //     console.error('Failed to fetch GPUs:', error);
  //   }
  // }, []);

  /**
   * Selects an environment and optional resources. Clears any previous selection.
   * @param environment The environment to select.
   * @param resources Optional resources to select.
   */
  const selectEnv = useCallback(
    ({
      environment,
      freeCompute,
      nodeInfo,
      resources,
    }: {
      environment: ComputeEnvironment | null;
      freeCompute: boolean;
      nodeInfo: EnvNodeInfo;
      resources?: EnvResourcesSelection;
    }) => {
      clearRunJobSelection();
      setSelectedEnv(environment);
      setFreeCompute(freeCompute);
      setNodeInfo(nodeInfo);
      const multiaddrs = new Set(nodeInfo?.multiaddrs?.filter(Boolean).filter(multiaddr));
      setMultiaddrsOrPeerId(multiaddrs.size > 0 ? Array.from(multiaddrs) : nodeInfo?.id);
      if (resources) {
        setSelectedResources(resources);
      }
    },
    [clearRunJobSelection]
  );

  const selectToken = useCallback(async (address: string, symbol?: string | null) => {
    if (symbol) {
      setSelectedToken({ address, symbol });
      return;
    } else {
      const symbol = await getTokenSymbol(address);
      if (symbol) {
        setSelectedToken({ address, symbol });
      }
    }
  }, []);

  const fetchEstimatedCost = useCallback(
    async ({
      environment,
      freeCompute,
      maxJobDurationSeconds,
      multiaddrsOrPeerId,
      onError,
      onSuccess,
      resources,
      tokenAddress,
    }: {
      environment: ComputeEnvironment;
      freeCompute: boolean;
      maxJobDurationSeconds: number;
      multiaddrsOrPeerId: MultiaddrsOrPeerId;
      onError?: (error: unknown) => void;
      onSuccess?: (cost: number, minLockSeconds: number) => void;
      resources: { id: string; amount: number }[];
      tokenAddress?: string;
    }) => {
      if (freeCompute || !tokenAddress) {
        setEstimatedTotalCost(0);
        return;
      }
      if (!provider || !p2pNode) {
        return;
      }
      const validUntil = maxJobDurationSeconds < 1 ? 1 : Math.ceil(maxJobDurationSeconds);
      let cost: string;
      let minLockSeconds: number;

      try {
        const result = await initializeCompute(
          environment,
          tokenAddress,
          validUntil,
          multiaddrsOrPeerId,
          environment.consumerAddress,
          resources,
          CHAIN_ID,
          provider
        );
        cost = result.cost;
        minLockSeconds = result.minLockSeconds;
      } catch (p2pError) {
        console.warn('P2P cost estimation failed, falling back to direct node command:', p2pError);
        const payload = {
          datasets: [],
          algorithm: { meta: { rawcode: 'rawcode' } },
          environment: environment.id,
          payment: {
            chainId: CHAIN_ID,
            token: tokenAddress,
            resources,
          },
          maxJobDuration: validUntil,
          consumerAddress: environment.consumerAddress,
          signature: '',
        };
        try {
          const multiaddrs = Array.isArray(multiaddrsOrPeerId) ? multiaddrsOrPeerId : undefined;
          const peerId =
            typeof multiaddrsOrPeerId === 'string'
              ? multiaddrsOrPeerId
              : (multiaddrs?.map((a) => a.match(/\/p2p\/(\S+)/)?.[1]).find(Boolean) ?? '');
          const response = await directNodeCommand({
            command: 'initializeCompute',
            body: payload,
            multiaddrs,
            peerId,
          });
          const data: {
            payment: { amount: string; minLockSeconds: number };
            status?: { httpStatus: number; error?: string };
          } = await response.json();
          if (data?.status?.httpStatus != null && data.status.httpStatus >= 400) {
            throw new Error(data.status.error ?? 'Initialize compute failed');
          }
          const tokenDecimals = await getTokenDecimals(tokenAddress);
          const decimalsNumber = Number(tokenDecimals);
          cost = new BigNumber(data.payment.amount)
            .div(new BigNumber(10).pow(decimalsNumber))
            .decimalPlaces(decimalsNumber)
            .toString();
          minLockSeconds = data.payment.minLockSeconds;
        } catch (directError) {
          onError?.(directError);
          console.error('Failed to fetch estimated cost:', directError);
          return;
        }
      }
      setEstimatedTotalCost(roundTokenAmount(Number(cost), tokenAddress, 'up'));
      setMinLockSeconds(minLockSeconds);
      onSuccess?.(Number(cost), minLockSeconds);
    },
    [initializeCompute, p2pNode, provider]
  );

  /**
   * Hydrate context with data from URL if available.
   *
   * Query params:
   * @param peerId - the peer ID of the node which has the selected environment
   * @param env - the ID of the selected environment
   * @param free - whether free compute was selected or not
   * @param gpus - selected GPUs (list of IDs)
   * @param cpu - selected CPU cores
   * @param ram - selected RAM GB
   * @param disk - selected disk GB
   * @param maxJobDuration - selected max job duration
   * @param token - selected fee token
   */
  const hydrateContextFromQueryParams = useCallback(async () => {
    if (!searchParams.size) {
      return;
    }
    const queryPeerId = searchParams.get('peerId');
    const queryEnv = searchParams.get('env');
    if (!queryPeerId || !queryEnv) {
      setHydrateFromUrlFinished(true);
      return;
    }
    try {
      const response = await axios.get<{ envs: NodeEnvironments[] }>(getApiRoute('environments'), {
        params: {
          filters: JSON.stringify({ id: { operator: 'eq', value: queryPeerId } }),
          // TODO: implement filter by node ID/ env ID on BE
          size: 1000,
        },
      });
      const foundNode = response.data.envs.find(
        (node) => node.id === queryPeerId && node.computeEnvironments.environments.find((env) => env.id === queryEnv)
      );
      const foundEnv = foundNode?.computeEnvironments.environments.find((env) => env.id === queryEnv);
      if (foundNode && foundEnv) {
        const multiaddrs = new Set(foundNode?.multiaddrs?.filter(Boolean).filter(multiaddr));
        const queryFree = searchParams.get('free') === 'true';
        const qJobDuration = searchParams.get('maxJobDuration');
        const queryGpusArray = searchParams.getAll('gpus[]');
        const queryGpus = queryGpusArray.length > 0 ? queryGpusArray : searchParams.getAll('gpus');
        let resources: EnvResourcesSelection = {
          gpus: queryGpus.map((gpuId) => {
            const gpuRes = foundEnv.resources?.find((res) => res.type === 'gpu' && res.id === gpuId);
            return { id: gpuId, description: gpuRes?.description };
          }),
          maxJobDurationSeconds: qJobDuration
            ? Number(qJobDuration)
            : queryFree
              ? (foundEnv.free?.minJobDuration ?? foundEnv.minJobDuration ?? 0)
              : (foundEnv.minJobDuration ?? 0),
        };
        const qCpu = searchParams.get('cpu');
        const cpu = foundEnv.resources?.find((res) => res.type === 'cpu' || res.id === 'cpu');
        if (qCpu && cpu) {
          resources = {
            ...resources,
            cpuCores: Number(qCpu),
            cpuId: cpu.id,
          };
        }
        const qRam = searchParams.get('ram');
        const ram = foundEnv.resources?.find((res) => res.type === 'ram' || res.id === 'ram');
        if (qRam && ram) {
          resources = {
            ...resources,
            ram: Number(qRam),
            ramId: ram.id,
          };
        }
        const qDisk = searchParams.get('disk');
        const disk = foundEnv.resources?.find((res) => res.type === 'disk' || res.id === 'disk');
        if (qDisk && disk) {
          resources = {
            ...resources,
            diskSpace: Number(qDisk),
            diskId: disk.id,
          };
        }
        selectEnv({
          environment: foundEnv,
          freeCompute: queryFree,
          nodeInfo: foundNode,
          resources,
        });
        if (!queryFree) {
          const queryToken = searchParams.get('token');
          if (queryToken) {
            await selectToken(queryToken);
            await fetchEstimatedCost({
              environment: foundEnv,
              freeCompute: queryFree,
              maxJobDurationSeconds: resources.maxJobDurationSeconds,
              multiaddrsOrPeerId: multiaddrs.size > 0 ? Array.from(multiaddrs) : foundNode.id,
              resources: [
                ...(resources.cpuId && resources.cpuCores ? [{ id: resources.cpuId, amount: resources.cpuCores }] : []),
                ...(resources.ramId && resources.ram ? [{ id: resources.ramId, amount: resources.ram }] : []),
                ...(resources.diskId && resources.diskSpace
                  ? [{ id: resources.diskId, amount: resources.diskSpace }]
                  : []),
                ...resources.gpus.map((gpu) => ({ id: gpu.id, amount: 1 })),
              ],
              tokenAddress: queryToken,
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to hydrate context from URL:', error);
    } finally {
      setHydrateFromUrlFinished(true);
    }
  }, [fetchEstimatedCost, searchParams, selectEnv, selectToken]);

  /**
   * Initiate hydration when initializing the context
   * If free compute was selected, we don't need to wait for the p2p node/ provider, but otherwise we need it to calculate cost
   */
  useEffect(() => {
    if (!hydrateFromUrlStarted) {
      if (!searchParams.size) {
        setHydrateFromUrlStarted(true);
        setHydrateFromUrlFinished(true);
      } else {
        const queryFree = searchParams.get('free') === 'true';
        // For paid compute, wait for p2p node and provider in order to fetch the cost (direct command is the fallback)
        // For free compute, they are not needed
        if (queryFree || (p2pNode && provider)) {
          setHydrateFromUrlStarted(true);
          hydrateContextFromQueryParams();
        }
      }
    }
  }, [hydrateContextFromQueryParams, hydrateFromUrlStarted, p2pNode, provider, searchParams]);

  return (
    <RunJobContext.Provider
      value={{
        estimatedTotalCost,
        fetchEstimatedCost,
        // fetchGpus,
        freeCompute,
        // gpus,
        hydrateFromUrlFinished,
        minLockSeconds,
        nodeInfo,
        multiaddrsOrPeerId,
        selectedEnv,
        selectEnv,
        selectedResources,
        selectedToken,
        selectToken,
        setEstimatedTotalCost,
        setMinLockSeconds,
        setSelectedResources,
      }}
    >
      {children}
    </RunJobContext.Provider>
  );
};

export const useRunJobContext = () => {
  const context = useContext(RunJobContext);
  if (!context) {
    throw new Error('useRunJobContext must be used within a RunJobProvider');
  }
  return context;
};
