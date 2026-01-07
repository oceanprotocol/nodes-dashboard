export type AnyNode = any;

export type BanStatusResponse = {
  /**
   *
   * Not coming from API, set during frontend enriching function
   */
  nodeId?: string;

  banned: boolean;
  banInfo?: NodeBanInfo;
};

export type NodeBanInfo = {
  reason: string;
  bannedAt: number;
  bannedUntil: number;
  weekNumber: number;
  year: number;
};

export type Node = {
  allowedAdmins?: string[];
  banInfo?: NodeBanInfo;
  cpus: CPU[];
  eligible?: boolean;
  eligibilityCauseStr?: string;
  friendlyName?: string;
  gpus: GPU[];
  id?: string;
  indexer?: Array<{ network: string }>;
  ipAndDns?: {
    dns: string;
  };
  latestBenchmarkResults: {
    gpuScore: number;
    cpuScore: number;
    bandwidth: number;
    totalScore: number;
  };
  latestGpuScore: number;
  latestCpuScore: number;
  location?: {
    region: string;
    ip: string;
    city: string;
    country: string;
  };
  nodeId: string;
  platform?: {
    osType: string;
    cpus?: string;
    arch?: string;
    machine?: string;
    node?: string;
    platform?: string;
  };
  provider?: Array<{ network: string }>;
  region: string;
  totalJobs: number;
  totalRevenue: number;
  version?: string;
  supportedStorage: any;
};

type GPU = {
  vendor: string;
  name: string;
};
type CPU = {
  family: string;
  model: string;
};

export enum NodeEligibility {
  ELIGIBLE = 'eligible',
  NON_ELIGIBLE = 'non-eligible',
  BANNED = 'banned',
}

export type GPUPopularityStats = GPUPopularity[];

export interface GPUPopularity {
  vendor: string;
  name: string;
  popularity: number;
}

export type GPUPopularityDisplay = {
  gpuName: string;
  popularity: number;
}[];

export type NodeStatsResponse = {
  totalBenchmarkJobs: number;
  totalNetworkJobs: number;
  totalJobs: number;
  benchmarkRevenue: number;
  networkRevenue: number;
  totalRevenue: number;
  data: {
    epochId: number;
    totalBenchmarkJobs: number;
    totalNetworkJobs: number;
    successfulBenchmarkJobs: number;
    successfulNetworkJobs: number;
    failedBenchmarkJobs: number;
    failedNetworkJobs: number;
    benchmarkRevenue: number;
    networkRevenue: number;
  }[];
};

export type BenchmarkMinMaxLastResponse = {
  lastCPUScore: number;
  lastGPUScore: number;
  maxCPUScore: number;
  maxGPUScore: number;
  minCPUScore: number;
  minGPUScore: number;
};

export type NodeBalance = {
  token: string;
  address: string;
  amount: number;
};
