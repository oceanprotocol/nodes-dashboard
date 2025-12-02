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
  friendly_name: string;
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
  };
  latest_gpu_score: number;
  latest_cpu_score: number;
  location?: {
    region: string;
    ip: string;
    city: string;
    country: string;
  };
  node_id: string;
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
  total_jobs: number;
  total_revenue: number;
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
  gpu_name: string;
  popularity: number;
}[];

export type NodeStatsResponse = {
  total_benchmark_jobs: number;
  total_network_jobs: number;
  total_jobs: number;
  benchmark_revenue: number;
  network_revenue: number;
  total_revenue: number;
  data: {
    epoch_id: number;
    total_benchmark_jobs: number;
    total_network_jobs: number;
    successful_benchmark_jobs: number;
    successful_network_jobs: number;
    failed_benchmark_jobs: number;
    failed_network_jobs: number;
    benchmark_revenue: number;
    network_revenue: number;
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
