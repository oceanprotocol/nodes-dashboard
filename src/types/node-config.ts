import { ComputeResourceId, ComputeResourceType } from '@/types/environments';

export type NodeConfig = Partial<{
  allowedAdmins: string[];
  allowedAdminsList: string[];
  claimDurationTimeout: number;
  paymentClaimInterval: number;
  persistentStorage: {
    enabled: boolean;
  };
  dockerComputeEnvironments: {
    access: {
      accessLists: { [chainId: string]: string[] }[];
      addresses: string[];
    };
    description?: string;
    enableNetwork?: boolean;
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
    storageExpiry?: number;
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
