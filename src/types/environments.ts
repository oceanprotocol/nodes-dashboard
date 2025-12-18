export interface ComputeEnvFeesStructure {
  feeToken: string;
  prices: { id: string; price: number }[];
}

type ComputeResourceType = 'cpu' | 'ram' | 'disk' | 'gpu';
type ComputeResourceId = 'cpu' | 'ram' | 'disk' | string;

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
  fees: ComputeEnvFeesStructure;
  id: string;
  nodeId: string;
  platform?: {
    architecture: string;
    os: string;
  description?: string;
  free?: {
    maxJobDuration?: number;
    maxJobs?: number;
    resources?: SlimComputeResource[];
  };
  fees: Record<string, ComputeEnvFeesStructure[]>;
  id: string;
  maxJobDuration?: number;
  maxJobs?: number;
  minJobDuration?: number;
  queMaxWaitTime: number;
  queMaxWaitTimeFree?: number;
  queuedFreeJobs?: number;
  queuedJobs: number;
  resources?: ComputeResource[];
  runningFreeJobs?: number;
  runningJobs: number;
  platform?: { architecture: string; os: string };
  storageExpiry?: number;
}};

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
  friendlyName?: string;
  id: string;
};
