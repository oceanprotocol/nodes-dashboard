/**
 * Next.js API Route: Initialize P2P Node
 * 
 * Explicitly trigger initialization of the server-side libp2p node
 * Useful for warming up the node before making requests
 * 
 * Endpoint: POST /api/p2p/init
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureNodeInitialized, getNodeStatus } from '@/services/p2pNodeService';

type InitResponse = {
  success: boolean;
  message?: string;
  status?: {
    initialized: boolean;
    ready: boolean;
    peerId?: string;
    connectedPeers?: number;
  };
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InitResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    console.log('[API Init] Initialization requested');
    
    // Trigger initialization (will wait if already initializing)
    await ensureNodeInitialized();
    
    // Get status after initialization
    const status = getNodeStatus();
    
    return res.status(200).json({
      success: true,
      message: 'Node initialized successfully',
      status,
    });
  } catch (error: any) {
    console.error('[API Init] Initialization failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize node',
    });
  }
}

// Configure API route
export const config = {
  api: {
    responseLimit: false,
  },
};
