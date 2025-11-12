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
  };
  region: string;
  total_jobs: number;
  total_revenue: number;
  version?: string;
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
