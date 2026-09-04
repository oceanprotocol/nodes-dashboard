export type ComputeResourceType = 'cpu' | 'ram' | 'disk' | 'gpu';
export type ComputeResourceId = 'cpu' | 'ram' | 'disk' | string;

export interface ComputeResourcesPricingInfo {
  id: ComputeResourceId;
  price: number;
}
export interface ComputeEnvFees {
  feeToken: string;
  prices: ComputeResourcesPricingInfo[];
}
export interface ComputeEnvFeesStructure {
  [chainId: string]: ComputeEnvFees[];
}

// Cross-resource constraint: a parent resource (the one that carries the `constraints` array)
// constrains a target resource. Mirrors ocean-node's ResourceConstraint (compute_engine_base.ts).
// Exactly one of `id` | `type` is set.
export type ResourceConstraint = {
  id?: ComputeResourceId; // exact single-resource target (e.g. 'ram', 'gpu0')
  type?: string; // group target: aggregate across all resources whose `type` matches (e.g. 'gpu')
  min?: number; // per unit of parent when perUnit (default), absolute floor when perUnit:false
  max?: number; // per unit of parent when perUnit (default), absolute ceiling when perUnit:false
  perUnit?: boolean; // undefined/true = RATIO (parentAmount * value); false = absolute FLOOR/ceiling
  aggregate?: boolean; // when true, contributions SUM across parents into one shared single-`id` target
};

type SlimComputeResource = {
  id: ComputeResourceId;
  max: number;
  inUse?: number;
  constraints?: ResourceConstraint[];
};

export type ComputeResource = {
  constraints?: ResourceConstraint[];
  description?: string;
  id: ComputeResourceId;
  inUse?: number;
  kind?: string;
  max: number;
  min: number;
  total: number;
  type?: ComputeResourceType;
};

export type AccessListContract = {
  [chainId: string]: string[];
};

export type EnvironmentAccess = {
  addresses: string[];
  accessLists: AccessListContract[];
};

export type ComputeEnvironment = {
  access?: EnvironmentAccess;
  consumerAddress: string;
  description?: string;
  enableNetwork?: boolean;
  /** Capability flags enabled on the node */
  features?: {
    /** `services` gates service-on-demand (long-lived containers, e.g. vLLM inference) */
    services?: boolean
  };
  fees?: ComputeEnvFeesStructure;
  free?: {
    access?: EnvironmentAccess;
    storageExpiry?: number;
    maxJobDuration?: number;
    maxJobs?: number;
    minJobDuration?: number;
    resources?: SlimComputeResource[];
  };
  id: string;
  maxJobDuration?: number;
  maxJobs?: number;
  minJobDuration?: number;
  /** Service-on-demand duration bounds. Distinct from min/maxJobDuration, which bound compute jobs
   *  only — read these through `serviceDurationBounds()` in `@/utils/service-duration`. */
  maxServiceDuration?: number;
  minServiceDuration?: number;
  nodeId: string;
  platform?: {
    architecture: string;
    os: string;
  };
  queMaxWaitTime: number;
  queMaxWaitTimeFree?: number;
  runMaxWaitTime: number;
  runMaxWaitTimeFree?: number;
  queuedFreeJobs?: number;
  queuedJobs: number;
  resources?: ComputeResource[];
  runningFreeJobs?: number;
  runningJobs: number;
  storageExpiry?: number;
};

export type SelectedGpu = {
  id: string;
  description?: string;
  amount: number;
};

export type EnvResourcesSelection = {
  cpuCores?: number;
  cpuId?: string;
  diskSpace?: number;
  diskId?: string;
  gpus: SelectedGpu[];
  // Total GPU units selected across all GPU entries. Drives the proportional CPU/RAM/disk split.
  gpuCount?: number;
  maxJobDurationSeconds: number;
  ram?: number;
  ramId?: string;
};

export type NodeEnvironments = EnvNodeInfo & {
  computeEnvironments: { environments: ComputeEnvironment[]; timestamp: number };
};

export type EnvNodeInfo = {
  currentAddrs?: string[];
  friendlyName?: string;
  id: string;
  latestBenchmarkResults?: {
    gpuScore: number;
    cpuScore: number;
    bandwidthScore: number;
    totalScore: number;
  };
  multiaddrs?: string[];
  verified?: boolean
};

export type MultiaddrsOrPeerId = string[] | string | null;
