import { getApiRoute } from '@/config';
import { MOCK_ENVS } from '@/mock/environments';
import { ApiPaginationResponse } from '@/types/api';
import { ComputeEnvironment } from '@/types/environments';
import axios from 'axios';
import { createContext, ReactNode, useContext, useState } from 'react';

type RunJobContextType = {
  environments: ComputeEnvironment[];
  fetchEnvironments: () => Promise<void>;
  selectedEnv: ComputeEnvironment | null;
  setSelectedEnv: React.Dispatch<React.SetStateAction<ComputeEnvironment | null>>;
};

const RunJobContext = createContext<RunJobContextType | undefined>(undefined);

export const RunJobProvider = ({ children }: { children: ReactNode }) => {
  const [environments, setEnvironments] = useState<ComputeEnvironment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<ComputeEnvironment | null>(null);

  const fetchEnvironments = async () => {
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
  };

  return (
    <RunJobContext.Provider value={{ environments, fetchEnvironments, selectedEnv, setSelectedEnv }}>
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
