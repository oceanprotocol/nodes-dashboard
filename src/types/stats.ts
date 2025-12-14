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

export interface OwnerStats extends AnalyticsGlobalStats {}

export interface OwnerStatsPerEpoch {
  epochId: number;
  totalNetworkRevenue: number;
  totalBenchmarkRevenue: number;
  totalNetworkJobs: number;
  totalBenchmarkJobs: number;
}

export interface ConsumerStats {
  totalJobs: number;
  totalPaidAmount: number;
  data: {
    epochId: number;
    totalJobs: number;
    totalPaidAmount: number;
  }[];
}

export interface ConsumerStatsPerEpoch {
  epochId: number;
  totalJobs: number;
  totalPaidAmount: number;
}
export interface JobsSuccessRate {
  totalCount: number;
  successCount: number;
  failedCount: number;
}

export interface ActiveNodes {
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
  inactiveNodes: string[];
}

export interface JobsSuccessRate {
  totalCount: number;
  successCount: number;
  failedCount: number;
}
