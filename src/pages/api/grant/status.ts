import { findGrantInSheet } from '@/api-services/gsheets';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.query as {
    walletAddress: string;
  };

  if (!walletAddress) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });
    if (!grant) {
      return response.status(404).json({ message: 'Grant not found' });
    }
    return response.status(200).json(grant.status);
  } catch (error) {
    console.error('Error getting grant status:', error);
    return response.status(500).json({ message: 'Failed to get grant status' });
  }
}
