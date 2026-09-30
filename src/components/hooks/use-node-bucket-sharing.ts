import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { BucketSharing, getNodeBucketSharing } from '@/services/nodeService';
import { useQuery } from '@tanstack/react-query';

type NodeBucketSharingState = {
  /** Undefined while loading, when there's no node yet, or when the node couldn't be reached. */
  sharing: BucketSharing | undefined;
  loading: boolean;
};

/**
 * The node's bucket-sharing setting, read from its status. Keyed by peer ID, so every bucket view of
 * the same node shares one lookup. A failed lookup reads as `undefined`, not `disabled`: the node is
 * the one that enforces the setting, so the UI only hides sharing when the node has said it's off.
 */
export function useNodeBucketSharing(node: { nodeId: string; nodeUri: NodeUri } | null): NodeBucketSharingState {
  // Node calls dial over the browser libp2p node, which comes up after mount.
  const { isReady } = useP2P();
  const query = useQuery({
    queryKey: ['node-bucket-sharing', node?.nodeId],
    enabled: isReady && !!node?.nodeId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: ({ signal }) => getNodeBucketSharing(node!.nodeUri, signal),
  });
  return {
    sharing: query.data,
    loading: query.isFetching && query.data === undefined,
  };
}
