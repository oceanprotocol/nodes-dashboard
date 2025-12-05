/**
 * Next.js API Route: P2P Command Proxy
 * 
 * This API route acts as an HTTPS wrapper over libp2p peer operations.
 * It runs the libp2p node on the server-side (Node.js) where WS connections are allowed,
 * and exposes HTTPS endpoints for the client to interact with peers.
 * 
 * Benefits:
 * - No mixed content issues (client uses HTTPS only)
 * - Server can use WS connections freely
 * - Single deployment (no separate proxy infrastructure)
 * - Better error handling and logging
 * 
 * Endpoint: POST /api/p2p/command
 * Body: { peerId: string, command: object, protocol?: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sendCommandToPeer } from '@/services/nodeService';
import { ensureNodeInitialized } from '@/services/p2pNodeService';

type CommandRequest = {
  peerId: string;
  command: Record<string, any>;
  protocol?: string;
};

type CommandResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CommandResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    // Parse request body
    const { peerId, command, protocol }: CommandRequest = req.body;

    // Validate request
    if (!peerId || typeof peerId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid peerId',
      });
    }

    if (!command || typeof command !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid command object',
      });
    }

    // Ensure node is initialized
    await ensureNodeInitialized();

    // Send command to peer
    console.log(`[API] Sending command to peer ${peerId}:`, command);
    const result = await sendCommandToPeer(peerId, command, protocol);

    // Return success response
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[API] Command failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

// Configure API route
export const config = {
  api: {
    // Increase timeout for long-running P2P operations
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
