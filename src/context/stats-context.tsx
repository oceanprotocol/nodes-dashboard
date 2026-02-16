import { getApiRoute } from '@/config';
import { GPUPopularityDisplay, GPUPopularityStats, Node } from '@/types/nodes';
import { AnalyticsGlobalStats, JobsPerEpochType, RevenuePerEpochType, SystemStatsData } from '@/types/stats';
import axios from 'axios';
import { ReactNode, createContext, useCallback, useContext, useState } from 'react';

type StatsContextType = {
  jobsPerEpoch: JobsPerEpochType[];
  revenuePerEpoch: RevenuePerEpochType[];
  systemStats: SystemStatsData;
  topGpuModels: GPUPopularityDisplay;
  topNodesByJobs: Node[];
  topNodesByRevenue: Node[];
  totalNetworkJobs: number;
  totalBenchmarkJobs: number;
  totalJobs: number;
  totalNetworkRevenue: number;
  totalBenchmarkRevenue: number;
  totalRevenue: number;
  fetchSystemStats: () => Promise<void>;
  fetchAnalyticsGlobalStats: () => Promise<void>;
  fetchTopGpus: () => Promise<void>;
  fetchTopNodesByRevenue: () => Promise<void>;
  fetchTopNodesByJobCount: () => Promise<void>;
};

const StatsContext = createContext<StatsContextType | undefined>(undefined);

export const StatsProvider = ({ children }: { children: ReactNode }) => {
  const [systemStats, setSystemStats] = useState<SystemStatsData>({
    cpuCounts: {},
    operatingSystems: {},
    cpuArchitectures: {},
  });
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalNetworkRevenue, setTotalNetworkRevenue] = useState<number>(0);
  const [totalBenchmarkRevenue, setTotalBenchmarkRevenue] = useState<number>(0);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [totalNetworkJobs, setTotalNetworkJobs] = useState<number>(0);
  const [totalBenchmarkJobs, setTotalBenchmarkJobs] = useState<number>(0);
  const [jobsPerEpoch, setJobsPerEpoch] = useState<JobsPerEpochType[]>([]);
  const [revenuePerEpoch, setRevenuePerEpoch] = useState<RevenuePerEpochType[]>([]);
  const [topGpuModels, setTopGpuModels] = useState<GPUPopularityDisplay>([]);
  const [topNodesByRevenue, setTopNodesByRevenue] = useState<Node[]>([]);
  const [topNodesByJobs, setTopNodesByJobs] = useState<Node[]>([]);

  const fetchTopNodesByRevenue = useCallback(async () => {
    try {
      const response = await axios.get<Node[]>(getApiRoute('topNodesByRevenue'), {
        params: {
          size: 5,
          page: 1,
          sort: JSON.stringify({
            totalRevenue: 'desc',
          }),
        },
      });
      if (response.data) {
        setTopNodesByRevenue(response.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchTopNodesByJobCount = useCallback(async () => {
    try {
      const response = await axios.get<Node[]>(getApiRoute('topNodesByJobCount'), {
        params: {
          size: 5,
          page: 1,
          sort: JSON.stringify({
            totalJobs: 'desc',
          }),
        },
      });
      if (response.data) {
        setTopNodesByJobs(response.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchTopGpus = useCallback(async () => {
    try {
      const response = await axios.get<GPUPopularityStats>(getApiRoute('gpuPopularity'));
      const res: GPUPopularityDisplay = response.data.map((gpu) => ({
        gpuName: `${gpu.vendor} ${gpu.name}`,
        popularity: gpu.popularity,
      }));
      setTopGpuModels(res);
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await axios.get<SystemStatsData>(getApiRoute('nodeSystemStats'));
      if (response.data) {
        setSystemStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchAnalyticsGlobalStats = useCallback(async () => {
    try {
      const response = await axios.get<AnalyticsGlobalStats>(getApiRoute('analyticsGlobalStats'));
      if (response.data) {
        setTotalNetworkRevenue(response.data.totalNetworkRevenue);
        setTotalBenchmarkRevenue(response.data.totalBenchmarkRevenue);
        setTotalRevenue(response.data.totalBenchmarkRevenue + response.data.totalNetworkRevenue);
        setTotalNetworkJobs(response.data.totalNetworkJobs);
        setTotalBenchmarkJobs(response.data.totalBenchmarkJobs);
        setTotalJobs(response.data.totalNetworkJobs + response.data.totalBenchmarkJobs);

        const jobs = [];
        const revenue = [];
        for (const item of response.data.data) {
          jobs.push({
            epochId: item.epochId,
            totalJobs: item.totalNetworkJobs + item.totalBenchmarkJobs,
            totalNetworkJobs: item.totalNetworkJobs,
            totalBenchmarkJobs: item.totalBenchmarkJobs,
          });
          revenue.push({
            epochId: item.epochId,
            totalRevenue: item.totalNetworkRevenue + item.totalBenchmarkRevenue,
            totalNetworkRevenue: item.totalNetworkRevenue,
            totalBenchmarkRevenue: item.totalBenchmarkRevenue,
          });
        }

        setJobsPerEpoch(jobs);
        setRevenuePerEpoch(revenue);
      }
    } catch (err) {
      console.error('Error fetching global stats from nodes analytics: ', err);
    }
  }, []);

  return (
    <StatsContext.Provider
      value={{
        jobsPerEpoch,
        revenuePerEpoch,
        totalBenchmarkRevenue,
        totalNetworkRevenue,
        totalBenchmarkJobs,
        totalNetworkJobs,
        systemStats,
        topGpuModels,
        topNodesByJobs,
        topNodesByRevenue,
        totalJobs,
        totalRevenue,
        fetchSystemStats,
        fetchAnalyticsGlobalStats,
        fetchTopGpus,
        fetchTopNodesByRevenue,
        fetchTopNodesByJobCount,
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
