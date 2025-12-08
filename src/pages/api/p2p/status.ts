/**
 * Next.js API Route: Node Status
 *
 * Check the status of the server-side libp2p node
 * Also triggers initialization if not already started
 *
 * Endpoint: GET /api/p2p/status
 */

import { ensureNodeInitialized, getNodeStatus } from '@/services/p2pNodeService';
import type { NextApiRequest, NextApiResponse } from 'next';

type StatusResponse = {
  initialized: boolean;
  ready: boolean;
  peerId?: string;
  connectedPeers?: number;
  addresses?: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<StatusResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      initialized: false,
      ready: false,
    });
  }

  try {
    // Trigger initialization if not already started
    // This is non-blocking - we return current status even if initializing
    ensureNodeInitialized().catch((error) => {
      console.error('[API Status] Initialization error:', error);
    });

    // Get current status
    const status = getNodeStatus();

    return res.status(200).json(status);
  } catch (error: any) {
    console.error('[API Status] Failed to get node status:', error);

    return res.status(500).json({
      initialized: false,
      ready: false,
    });
  }
}
