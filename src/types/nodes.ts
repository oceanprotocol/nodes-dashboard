export type AnyNode = any;

export type Node = {
  id?: string;
  node_id: string;
  friendly_name: string;
  location?: {
    region: string;
  };
  eligible?: boolean;
  eligibilityCauseStr?: string;
  region: string;
  latest_gpu_score: number;
  latest_cpu_score: number;
  total_jobs: number;
  total_revenue: number;
  latestBenchmarkResults: {
    gpuScore: number;
    cpuScore: number;
    bandwidth: number;
  };
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
