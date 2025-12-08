/**
 * Shared P2P Node Initialization Service
 *
 * This module manages the server-side libp2p node instance as a singleton.
 * It ensures the node is initialized only once and shared across all API routes.
 */

import { getNodeInstance, getNodeReadyState, initializeNode } from '@/services/nodeService';
import { OCEAN_BOOTSTRAP_NODES } from '@/shared/consts/bootstrapNodes';

// Singleton state
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the server-side libp2p node
 * This runs once and persists across API requests
 *
 * @returns Promise that resolves when node is initialized
 */
export async function ensureNodeInitialized(): Promise<void> {
  // If already initialized, return immediately
  const node = getNodeInstance();
  const ready = getNodeReadyState();

  if (node && ready) {
    console.log('[P2P Service] Node already initialized and ready');
    return;
  }

  // If currently initializing, wait for that to complete
  if (isInitializing && initializationPromise) {
    console.log('[P2P Service] Initialization in progress, waiting...');
    return initializationPromise;
  }

  // Start initialization
  isInitializing = true;
  console.log('[P2P Service] Initializing server-side libp2p node...');

  initializationPromise = (async () => {
    try {
      await initializeNode(OCEAN_BOOTSTRAP_NODES);
      console.log('[P2P Service] ✓ Server-side node initialized successfully');
    } catch (error) {
      console.error('[P2P Service] ✗ Failed to initialize node:', error);
      isInitializing = false;
      initializationPromise = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

/**
 * Get the current node status
 */
export function getNodeStatus() {
  const node = getNodeInstance();
  const ready = getNodeReadyState();

  if (!node) {
    return {
      initialized: false,
      ready: false,
    };
  }

  try {
    const peers = node.getPeers();
    const multiaddrs = node.getMultiaddrs();

    return {
      initialized: true,
      ready,
      peerId: node.peerId.toString(),
      connectedPeers: peers.length,
      addresses: multiaddrs.map((ma) => ma.toString()),
    };
  } catch (error) {
    console.error('[P2P Service] Error getting node status:', error);
    return {
      initialized: true,
      ready: false,
    };
  }
}
