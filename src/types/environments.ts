interface ComputeResourcesPricingInfo {
  id: ComputeResourceType;
  price: number; // price per unit per minute
}

interface ComputeEnvFees {
  feeToken: string;
  prices: ComputeResourcesPricingInfo[];
}

interface ComputeEnvFeesStructure {
  [chainId: string]: ComputeEnvFees[];
}

type ComputeResourceType = 'cpu' | 'ram' | 'disk' | any;

export interface ComputeResource {
  id: ComputeResourceType;
  description?: string;
  type?: string;
  kind?: string;
  // total: number;
  max: number;
  // min: number;
  inUse?: number;
}

interface ComputeEnvironmentFreeOptions {
  // only if a compute env exposes free jobs
  storageExpiry?: number;
  maxJobDuration?: number;
  maxJobs?: number; // maximum number of simultaneous free jobs
  resources?: ComputeResource[];
}

// TODO - use type from @oceanprotocol/lib when it's up to date

export type ComputeEnvironment = ComputeEnvironmentFreeOptions & {
  fees: ComputeEnvFeesStructure;
  free?: ComputeEnvironmentFreeOptions;
  id: string;
};

export type EnvResourcesSelection = {
  cpuCores: number;
  diskSpace: number;
  gpus: { id: string; description?: string }[];
  maxJobDurationHours: number;
  ram: number;
};
