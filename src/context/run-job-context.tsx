import { getApiRoute } from '@/config';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { MOCK_ENVS } from '@/mock/environments';
import { ApiPaginationResponse } from '@/types/api';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { GPUPopularityDisplay, GPUPopularityStats } from '@/types/nodes';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export type SelectedToken = {
  symbol: string;
  address: string;
};

type RunJobContextType = {
  environments: ComputeEnvironment[];
  estimatedTotalCost: number | null;
  fetchEnvironments: () => Promise<void>;
  fetchGpus: () => Promise<void>;
  gpus: GPUPopularityDisplay;
  selectedEnv: ComputeEnvironment | null;
  selectedResources: EnvResourcesSelection | null;
  selectedToken: SelectedToken | null;
  selectEnv: (environment: ComputeEnvironment | null, resources?: EnvResourcesSelection) => void;
  selectToken: (address: string, symbol?: string | null) => void | Promise<void>;
  setEstimatedTotalCost: (cost: number | null) => void;
  setSelectedResources: (selection: EnvResourcesSelection | null) => void;
};

const RunJobContext = createContext<RunJobContextType | undefined>(undefined);

export const RunJobProvider = ({ children }: { children: ReactNode }) => {
  const { ocean } = useOceanAccount();

  const [environments, setEnvironments] = useState<ComputeEnvironment[]>([]);
  const [estimatedTotalCost, setEstimatedTotalCost] = useState<number | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<ComputeEnvironment | null>(null);
  const [selectedResources, setSelectedResources] = useState<EnvResourcesSelection | null>(null);
  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);
  const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);

  const clearRunJobSelection = useCallback(() => {
    setEstimatedTotalCost(null);
    setSelectedEnv(null);
    setSelectedResources(null);
    setSelectedToken(null);
  }, []);

  const fetchEnvironments = useCallback(async () => {
    try {
      const response = await axios.get<{ envs: ComputeEnvironment[]; pagination: ApiPaginationResponse }>(
        getApiRoute('environments')
      );
      if (response.data) {
        // setEnvironments(response.data.envs);
        setEnvironments(MOCK_ENVS);
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error);
    }
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
    (environment: ComputeEnvironment | null, resources?: EnvResourcesSelection) => {
      clearRunJobSelection();
      setSelectedEnv(environment);
      if (resources) {
        setSelectedResources(resources);
      }
    },
    [clearRunJobSelection]
  );

  const selectToken = useCallback(
    async (address: string, symbol?: string | null) => {
      if (symbol) {
        setSelectedToken({ address, symbol });
        return;
      } else if (ocean) {
        const symbol = await ocean.getSymbolByAddress(address);
        setSelectedToken({ address, symbol });
      }
    },
    [ocean]
  );

  return (
    <RunJobContext.Provider
      value={{
        estimatedTotalCost,
        environments,
        fetchEnvironments,
        fetchGpus,
        gpus,
        selectedEnv,
        selectEnv,
        selectedResources,
        selectedToken,
        selectToken,
        setEstimatedTotalCost,
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
