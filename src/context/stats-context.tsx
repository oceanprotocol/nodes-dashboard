import { getApiRoute } from '@/config';
import { GPUPopularity, GPUPopularityStats, Node } from '@/types/nodes';
import { AnalyticsGlobalStats, JobsPerEpochType, RevenuePerEpochType, SystemStatsData } from '@/types/stats';
import axios from 'axios';
import { ReactNode, createContext, useCallback, useContext, useState } from 'react';

type StatsContextType = {
  jobsPerEpoch: JobsPerEpochType[];
  revenuePerEpoch: RevenuePerEpochType[];
  systemStats: SystemStatsData;
  topGpuModels: GPUPopularity[];
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
  const [topGpuModels, setTopGpuModels] = useState<GPUPopularityStats>([]);
  const [topNodesByRevenue, setTopNodesByRevenue] = useState<Node[]>([]);
  const [topNodesByJobs, setTopNodesByJobs] = useState<Node[]>([]);

  const fetchTopNodesByRevenue = useCallback(async () => {
    try {
      const response = await axios.get<Node[]>(getApiRoute('topNodesByRevenue'), {
        params: {
          size: 5,
          page: 1,
          sort: JSON.stringify({
            total_revenue: 'desc',
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
            total_jobs: 'desc',
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
      setTopGpuModels(response.data);
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
        setTotalNetworkRevenue(response.data.total_network_revenue);
        setTotalBenchmarkRevenue(response.data.total_benchmark_revenue);
        setTotalRevenue(response.data.total_benchmark_revenue + response.data.total_network_revenue);
        setTotalNetworkJobs(response.data.total_network_jobs);
        setTotalBenchmarkJobs(response.data.total_benchmark_jobs);
        setTotalJobs(response.data.total_network_jobs + response.data.total_benchmark_jobs);

        const jobs = [];
        const revenue = [];
        for (const item of response.data.data) {
          jobs.push({
            epoch_id: item.epoch_id,
            total_jobs: item.total_network_jobs + item.total_benchmark_jobs,
            total_network_jobs: item.total_network_jobs,
            total_benchmark_jobs: item.total_benchmark_jobs,
          });
          revenue.push({
            epoch_id: item.epoch_id,
            total_revenue: item.total_network_revenue + item.total_benchmark_revenue,
            total_network_revenue: item.total_network_revenue,
            total_benchmark_revenue: item.total_benchmark_revenue,
          });
        }

        console.log({ jobs });
        console.log({ revenue });
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
