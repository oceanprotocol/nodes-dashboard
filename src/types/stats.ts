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
  epoch_id: number;
  total_network_jobs: number;
  total_benchmark_jobs: number;
  total_jobs?: number;
};

export type RevenuePerEpochType = {
  epoch_id: number;
  total_network_revenue: number;
  total_benchmark_revenue: number;
  total_revenue?: number;
};

export interface AnalyticsGlobalStats {
  total_network_revenue: number;
  total_benchmark_revenue: number;
  total_network_jobs: number;
  total_benchmark_jobs: number;
  data: {
    epoch_id: number;
    total_network_revenue: number;
    total_benchmark_revenue: number;
    total_network_jobs: number;
    total_benchmark_jobs: number;
  }[];
}
