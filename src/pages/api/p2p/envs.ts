/**
 * Next.js API Route: Get Node Environments
 * 
 * Convenience endpoint for getting compute environments from a peer
 * 
 * Endpoint: GET /api/p2p/envs?peerId=16Uiu2...
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getNodeEnvs } from '@/services/nodeService';
import { ensureNodeInitialized } from '@/services/p2pNodeService';

type EnvsResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EnvsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET.',
    });
  }

  try {
    const { peerId } = req.query;

    if (!peerId || typeof peerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid peerId query parameter',
      });
    }

    await ensureNodeInitialized();

    console.log(`[API] Getting environments for peer ${peerId}`);
    const result = await getNodeEnvs(peerId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API] Failed to get environments:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

export const config = {
  api: {
    responseLimit: false,
  },
};
