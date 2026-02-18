type ComputeResourceType = 'cpu' | 'ram' | 'disk' | 'gpu';
type ComputeResourceId = 'cpu' | 'ram' | 'disk' | string;

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

type SlimComputeResource = {
  id: ComputeResourceId;
  max: number;
  inUse?: number;
};

export type ComputeResource = {
  description?: string;
  id: ComputeResourceId;
  inUse?: number;
  kind?: string;
  max: number;
  min: number;
  total: number;
  type?: ComputeResourceType;
};

export type ComputeEnvironment = {
  consumerAddress: string;
  description?: string;
  fees: ComputeEnvFeesStructure;
  free?: {
    storageExpiry?: number;
    maxJobDuration?: number;
    maxJobs?: number;
    resources?: SlimComputeResource[];
  };
  id: string;
  maxJobDuration?: number;
  maxJobs?: number;
  minJobDuration?: number;
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

export type NodeEnvironments = EnvNodeInfo & {
  computeEnvironments: { environments: ComputeEnvironment[]; timestamp: number };
};

export type EnvNodeInfo = {
  currentAddrs?: string[];
  friendlyName?: string;
  id: string;
  multiaddrs?: string[];
};

export type MultiaddrsOrPeerId = string | string[] | null;
