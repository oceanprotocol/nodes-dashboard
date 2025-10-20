import { MOCK_JOBS_PER_EPOCH, MOCK_REVENUE_PER_EPOCH, MOCK_TOTAL_JOBS, MOCK_TOTAL_REVENUE } from '@/mock/stats';
import { createContext, ReactNode, useContext } from 'react';

// TODO: Replace mock data with real data
type StatsContextType = {
  jobsPerEpoch: any[];
  revenuePerEpoch: any[];
  totalJobs: number;
  totalRevenue: number;
};

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export const StatsProvider = ({ children }: { children: ReactNode }) => {
  return (
    <StatsContext.Provider
      value={{
        // TODO: Replace mock data with real data
        jobsPerEpoch: MOCK_JOBS_PER_EPOCH,
        revenuePerEpoch: MOCK_REVENUE_PER_EPOCH,
        totalJobs: MOCK_TOTAL_JOBS,
        totalRevenue: MOCK_TOTAL_REVENUE,
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
