import { getApiRoute } from '@/config';
import { getTokenSymbol } from '@/lib/token-symbol';
import { MultiaddrsOrPeerId } from '@/services/nodeService';
import { ComputeEnvironment, EnvNodeInfo, EnvResourcesSelection } from '@/types/environments';
import { GPUPopularityDisplay, GPUPopularityStats } from '@/types/nodes';
import { multiaddr } from '@multiformats/multiaddr';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export type SelectedToken = {
  symbol: string;
  address: string;
};

type RunJobContextType = {
  estimatedTotalCost: number | null;
  fetchGpus: () => Promise<void>;
  freeCompute: boolean;
  gpus: GPUPopularityDisplay;
  minLockSeconds: number | null;
  nodeInfo: EnvNodeInfo | null;
  multiaddrsOrPeerId: MultiaddrsOrPeerId | null;
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
  const [minLockSeconds, setMinLockSeconds] = useState<number | null>(null);
  const [nodeInfo, setNodeInfo] = useState<EnvNodeInfo | null>(null);
  const [multiaddrsOrPeerId, setMultiaddrsOrPeerId] = useState<MultiaddrsOrPeerId | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<ComputeEnvironment | null>(null);
  const [selectedResources, setSelectedResources] = useState<EnvResourcesSelection | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);

  const clearRunJobSelection = useCallback(() => {
    setEstimatedTotalCost(null);
    setFreeCompute(false);
    setMinLockSeconds(null);
    setNodeInfo(null);
    setMultiaddrsOrPeerId(null);
    setSelectedEnv(null);
    setSelectedResources(null);
    setSelectedToken(null);
  }, []);

  // TODO fetch all GPUs not only top 5
  const fetchGpus = useCallback(async () => {
    try {
      const response = await axios.get<GPUPopularityStats>(getApiRoute('gpuPopularity'));
      const res: GPUPopularityDisplay = response.data.map((gpu) => ({
        gpuName: `${gpu.vendor} ${gpu.name}`,
        popularity: gpu.popularity,
      }));
      setGpus(res);
    } catch (error) {
      console.error('Failed to fetch GPUs:', error);
    }
  }, []);

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

  return (
    <RunJobContext.Provider
      value={{
        estimatedTotalCost,
        fetchGpus,
        freeCompute,
        gpus,
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
