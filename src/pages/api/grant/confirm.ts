// import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
// import { GrantStatus } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  // TODO re-enable grants
  return response.status(403).json({ message: 'Grants are not available at the moment' });

  // if (request.method !== 'POST') {
  //   return response.status(405).json({ message: 'Method not allowed' });
  // }

  // const { walletAddress, txHash } = request.body;

  // if (!walletAddress || !txHash) {
  //   return response.status(400).json({ message: 'Missing required fields' });
  // }

  // try {
  //   const grant = await findGrantInSheet({ walletAddress });
  //   if (!grant) {
  //     return response.status(404).json({ message: 'Grant not found' });
  //   }

  //   if (grant.status === GrantStatus.CLAIMED) {
  //     return response.status(200).json({ message: 'Already marked as claimed' });
  //   }

  //   await updateGrantInSheet({
  //     ...grant,
  //     claimDate: new Date(),
  //     status: GrantStatus.CLAIMED,
  //     txHash,
  //   });

  //   return response.status(200).json('');
  // } catch (error) {
  //   console.error('Error confirming claim:', error);
  //   return response.status(500).json({ message: 'Failed to confirm claim' });
  // }
}
