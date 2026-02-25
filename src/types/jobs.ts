export type Job = any;

export interface ComputeJobHistory {
  jobId: string;
  peerId: string;
  environmentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  startTime: number;
  endTime?: number;
  maxDuration: number;
  resources: { id: string; amount: number }[];
  errorMessage?: string;
  worker1Id: string;
  worker2Id?: string;
  consumerAddress: string;
  signature: string;
  nonce: string;
  peerMultiaddrs: string[];
  resultHashes?: number;
  seed?: string;
  difficulty?: number;
  payment?: {
    token: string;
    cost: number;
    [key: string]: any;
  };
  benchmarkResults?: {
    cpuScore?: number;
    gpuScore?: number;
    bandwidthScore?: number;
    cpuValid?: boolean;
    gpuValid?: boolean;
    cpuSeed?: string;
    gpuSeed?: string;
    bandwidthMbps?: number;
    bandwidthTests?: number;
    bandwidthMegabytes?: number;
    gpus?: { vendor: string; name: string }[];
    cpus?: { family: string; model: string }[];
    verificationError?: string;
  };
}

export interface ComputeJob {
  owner: string;
  peerId: string;
  nodeFriendlyName: string;
  epoch: number;
  errorMessage?: string;
  did: string;
  jobId: string;
  dateCreated: number;
  dateFinished: number;
  status: number;
  statusText: string;
  results: any;
  inputDID: string;
  algoDID: string;
  agreementId: string;
  environment: string;
  environmentId: string;
  clusterHash: string;
  configlogURL: string;
  publishlogURL: string;
  algologURL: string;
  outputsURL: string;
  stopRequested: boolean;
  algorithm: any;
  assets: any;
  isRunning: boolean;
  isStarted: boolean;
  containerImage: string;
  resources: any;
  isFree: boolean;
  algoStartTimestamp: number;
  maxJobDuration: number;
  payment: {
    token: string;
    cost: number;
  };
}

export type BenchmarkJobHistory = {
  benchmarkResults: {
    bandwidthMbps: number;
    bandwidthMegabytes: number;
    bandwidthScore: number;
    bandwidthTests: number;
    cpuScore: number | null;
    cpuSeed: string;
    cpuValid: boolean;
    cpus: {
      model: string;
      family: string;
    }[];
    gpuScore: number | null;
    gpuValid: boolean;
    gpuSeed: string;
  };
  consumerAddress: string;
  difficulty: number;
  endTime: number;
  environmentId: string;
  errorMessage: string;
  jobId: string;
  maxDuration: number;
  nonce: string;
  paymentInfo: {
    chainId: number;
    cost: number;
    costInSmallestUnits: string;
    fees: number;
    maxDuration: number;
    priceBreakdown: {
      id: string;
      price: number;
    }[];
    token: string;
  };
  providerAddress: string;
  queueJobId: string;
  resources: {
    amount: number;
    id: string;
  }[];
  seed: string;
  signature: string;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  worker1Id: string;
  worker2Id: string;
};
