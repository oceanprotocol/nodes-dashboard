import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { BucketSharing, getNodeBucketSharing } from '@/services/nodeService';
import { useQuery } from '@tanstack/react-query';

type NodeBucketSharingState = {
  /** Undefined while loading, when there's no node yet, or when the node couldn't be reached. */
  sharing: BucketSharing | undefined;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

/**
 * Read the node’s setting using its current dial address. Failed lookups remain unknown so creation
 * can offer retry instead of deploying an access list without knowing whether sharing is supported.
 */
export function useNodeBucketSharing(node: { nodeId: string; nodeUri: NodeUri } | null): NodeBucketSharingState {
  // Node calls dial over the browser libp2p node, which comes up after mount.
  const { isReady } = useP2P();
  const query = useQuery({
    queryKey: ['node-bucket-sharing', node?.nodeId, node?.nodeUri],
    enabled: isReady && !!node?.nodeId,
    staleTime: 0,
    retry: 1,
    queryFn: ({ signal }) => getNodeBucketSharing(node!.nodeUri, signal),
  });
  return {
    sharing: query.data,
    loading: !!node?.nodeId && query.isPending,
    error: query.isError,
    retry: () => {
      void query.refetch();
    },
  };
}
