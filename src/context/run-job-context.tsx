import { getTokenSymbol } from '@/lib/token-symbol';
import { ComputeEnvironment, EnvNodeInfo, EnvResourcesSelection, MultiaddrsOrPeerId } from '@/types/environments';
import { multiaddr } from '@multiformats/multiaddr';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type SelectedToken = {
  symbol: string;
  address: string;
};

type RunJobContextType = {
  estimatedTotalCost: number | null;
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
    setHydrateFromUrlFinished(true);
  }, []);

  /**
   * Initiate hydration when initializing the context
   */
  useEffect(() => {
    if (!hydrateFromUrlStarted) {
      setHydrateFromUrlStarted(true);
      hydrateContextFromQueryParams();
    }
  }, [hydrateContextFromQueryParams, hydrateFromUrlStarted]);

  return (
    <RunJobContext.Provider
      value={{
        estimatedTotalCost,
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
