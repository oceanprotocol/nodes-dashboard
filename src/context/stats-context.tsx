import { getApiRoute } from '@/config';
import { MOCK_NODES } from '@/mock/nodes';
import {
  MOCK_JOBS_PER_EPOCH,
  MOCK_REVENUE_PER_EPOCH,
  MOCK_TOP_GPU_MODELS,
  MOCK_TOTAL_JOBS,
  MOCK_TOTAL_REVENUE,
} from '@/mock/stats';
import { Node } from '@/types/nodes';
import { SystemStatsData } from '@/types/stats';
import axios from 'axios';
import { ReactNode, createContext, useCallback, useContext, useState } from 'react';

// TODO: Replace mock data with real data
type StatsContextType = {
  jobsPerEpoch: any[];
  revenuePerEpoch: any[];
  systemStats: SystemStatsData;
  topGpuModels: any[];
  topNodesByJobs: Node[];
  topNodesByRevenue: Node[];
  totalJobs: number;
  totalRevenue: number;
  fetchSystemStats: () => Promise<void>;
};

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export const StatsProvider = ({ children }: { children: ReactNode }) => {
  const [systemStats, setSystemStats] = useState<SystemStatsData>({
    cpuCounts: {},
    operatingSystems: {},
    cpuArchitectures: {},
  });

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await axios.get(getApiRoute('nodeSystemStats'));
      if (response.data) {
        setSystemStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  return (
    <StatsContext.Provider
      value={{
        // TODO: Replace mock data with real data
        jobsPerEpoch: MOCK_JOBS_PER_EPOCH,
        revenuePerEpoch: MOCK_REVENUE_PER_EPOCH,
        systemStats,
        topGpuModels: MOCK_TOP_GPU_MODELS,
        topNodesByJobs: MOCK_NODES,
        topNodesByRevenue: MOCK_NODES,
        totalJobs: MOCK_TOTAL_JOBS,
        totalRevenue: MOCK_TOTAL_REVENUE,
        fetchSystemStats,
      }}
    >
      {children}
    </StatsContext.Provider>
  );
};

export const useStatsContext = () => {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStatsContext must be used within a StatsProvider');
  }
  return context;
};
