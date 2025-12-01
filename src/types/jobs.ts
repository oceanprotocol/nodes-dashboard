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
  paymentInfo?: {
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
