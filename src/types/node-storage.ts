import type { NodeUri } from '@/contexts/P2PContext';

/**
 * All a bucket view needs to talk to a node: the peer ID its buckets are keyed by, and the URI the
 * request is sent to. Keeps those views usable for a node the user typed in by peer ID, not only
 * for the indexed `Node` records the node pages pass around.
 */
export type StorageNode = {
  friendlyName?: string;
  nodeId: string;
  nodeUri: NodeUri;
};

export type BucketAccessStateType = 'new' | 'existing' | 'none';

export type BucketAccessState =
  | {
      mode: 'new';
      wallets: string[];
    }
  | {
      mode: 'existing';
      address: string;
    }
  | {
      mode: 'none';
    };

export type ChainAddressPair = {
  chainId: string;
  address: string;
};
