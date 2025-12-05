import { getApiRoute } from '@/config';
import { MOCK_ENVS } from '@/mock/environments';
import { ApiPaginationResponse } from '@/types/api';
import { ComputeEnvironment } from '@/types/environments';
import { GPUPopularityDisplay, GPUPopularityStats } from '@/types/nodes';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type RunJobContextType = {
  environments: ComputeEnvironment[];
  fetchEnvironments: () => Promise<void>;
  fetchGpus: () => Promise<void>;
  gpus: GPUPopularityDisplay;
  selectedEnv: ComputeEnvironment | null;
  setSelectedEnv: (environment: ComputeEnvironment | null) => void;
};

const RunJobContext = createContext<RunJobContextType | undefined>(undefined);

export const RunJobProvider = ({ children }: { children: ReactNode }) => {
  const [environments, setEnvironments] = useState<ComputeEnvironment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<ComputeEnvironment | null>(null);
  const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);

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

  return (
    <RunJobContext.Provider value={{ environments, fetchEnvironments, fetchGpus, gpus, selectedEnv, setSelectedEnv }}>
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
