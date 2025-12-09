interface ComputeResourcesPricingInfo {
  id: ComputeResourceId;
  price: number; // price per unit per minute
}

interface ComputeEnvFees {
  feeToken: string;
  prices: ComputeResourcesPricingInfo[];
}

interface ComputeEnvFeesStructure {
  [chainId: string]: ComputeEnvFees[];
}

type ComputeResourceType = 'cpu' | 'ram' | 'disk' | 'gpu';
type ComputeResourceId = 'cpu' | 'ram' | 'disk' | string;

export interface ComputeResource {
  id: ComputeResourceId;
  description?: string;
  type?: ComputeResourceType;
  kind?: string;
  total?: number;
  max: number;
  min?: number;
  inUse?: number;
}

interface ComputeEnvironmentFreeOptions {
  // only if a compute env exposes free jobs
  access?: {
    addresses: string[];
    accessLists: string[];
  };
  storageExpiry?: number;
  maxJobDuration?: number;
  maxJobs?: number; // maximum number of simultaneous free jobs
  resources?: ComputeResource[];
}

// TODO - use type from @oceanprotocol/lib when it's up to date

export type ComputeEnvironment = ComputeEnvironmentFreeOptions & {
  consumerAddress: string;
  fees: ComputeEnvFeesStructure;
  free?: ComputeEnvironmentFreeOptions;
  id: string;
  platform?: {
    architecture: string;
    os: string;
  };
  queuedJobs?: number;
  queuedFreeJobs?: number;
  queMaxWaitTime?: number;
  queMaxWaitTimeFree?: number;
  runningFreeJobs?: number;
  runningJobs?: number;
};

export type EnvResourcesSelection = {
  cpuCores: number;
  cpuId: string;
  diskSpace: number;
  diskId: string;
  gpus: { id: string; description?: string }[];
  maxJobDurationHours: number;
  ram: number;
  ramId: string;
};
