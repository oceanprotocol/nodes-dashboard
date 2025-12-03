export interface SystemStatsData {
  cpuCounts: {
    [key: string]: number;
  };
  operatingSystems: {
    [key: string]: number;
  };
  cpuArchitectures: {
    [key: string]: number;
  };
}

export type JobsPerEpochType = {
  epochId: number;
  totalNetworkJobs: number;
  totalBenchmarkJobs: number;
  totalJobs?: number;
};

export type RevenuePerEpochType = {
  epochId: number;
  totalNetworkRevenue: number;
  totalBenchmarkRevenue: number;
  totalRevenue?: number;
};

export interface AnalyticsGlobalStats {
  totalNetworkRevenue: number;
  totalBenchmarkRevenue: number;
  totalNetworkJobs: number;
  totalBenchmarkJobs: number;
  data: {
    epochId: number;
    totalNetworkRevenue: number;
    totalBenchmarkRevenue: number;
    totalNetworkJobs: number;
    totalBenchmarkJobs: number;
  }[];
}
