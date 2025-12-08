import { sendCommandToPeer } from '@/services/nodeService';
import { ensureNodeInitialized } from '@/services/p2pNodeService';
import type { NextApiRequest, NextApiResponse } from 'next';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<CommandResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  try {
    const { peerId, command, protocol }: CommandRequest = req.body;

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

    await ensureNodeInitialized();

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
