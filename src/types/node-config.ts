import { ComputeResourceId, ComputeResourceType } from '@/types/environments';

export type NodeConfig = Partial<{
  allowedAdmins: string[];
  dockerComputeEnvironments: {
    access: {
      accessLists: { [chainId: string]: string[] }[];
      addresses: string[];
    };
    fees: {
      [chainId: string]: {
        feeToken: string;
        prices: {
          id: string;
          price: number;
        }[];
      }[];
    };
    maxJobDuration?: number;
    minJobDuration?: number;
    resources: {
      description?: string;
      id: ComputeResourceId;
      max?: number;
      min?: number;
      total: number;
      type?: ComputeResourceType;
    }[];
    free?: {
      access: {
        accessLists: { [chainId: string]: string[] }[];
        addresses: string[];
      };
      maxJobDuration?: number;
      maxJobs: number;
      minJobDuration?: number;
      resources: {
        id: string;
        max: number;
      }[];
    };
  }[];
  hasHttp: boolean;
  hasIndexer: boolean;
  httpPort: number;
  supportedNetworks: {
    [chainId: string]: {
      chainId: number;
      chunkSize: number;
      network: string;
      rpc: string;
      startBlock?: number;
    };
  };
}>;
