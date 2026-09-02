import type { StorageNode } from '@/types/node-storage';
import type { NodeToken } from '@/types/node-tokens';
import type { Node } from '@/types/nodes';

/**
 * Indexed node record -> bucket-view node. Multiaddrs win over the peer ID when the index has them:
 * dialing a known address skips peer discovery.
 */
export const toStorageNode = (node: Node): StorageNode => {
  const nodeId = node.id ?? node.nodeId ?? '';
  return {
    friendlyName: node.friendlyName,
    nodeId,
    nodeUri: node.currentAddrs?.length ? node.currentAddrs : nodeId,
  };
};

/**
 * A stored auth token remembers the URI its node was reached at, so buckets can be listed without
 * looking the node up in the index first. Falls back to the peer ID when no token carries a URI.
 */
export const tokenNodeToStorageNode = (nodeId: string, tokens: NodeToken[]): StorageNode => {
  const named = tokens.find((token) => token.friendlyNodeName);
  const withUri = tokens.find((token) => (Array.isArray(token.nodeUri) ? token.nodeUri.length > 0 : token.nodeUri));
  return {
    friendlyName: named?.friendlyNodeName,
    nodeId,
    nodeUri: withUri?.nodeUri ?? nodeId,
  };
};

/** A node the user typed in: the peer ID is both the key and the dial target. */
export const peerIdToStorageNode = (peerId: string): StorageNode => ({ nodeId: peerId, nodeUri: peerId });
