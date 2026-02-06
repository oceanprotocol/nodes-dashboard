// import { exportToGSheets } from '@/api-services/gsheets';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantStatus } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const { email } = request.body;
  try {
    const grant = await findGrantInSheet(email);
    if (!grant) {
      return response.status(404).json({ message: 'Grant not found' });
    }
    if (grant.status === GrantStatus.REDEEMED) {
      return response.status(400).json({ message: 'Grant already redeemed' });
    }
    grant.redeemDate = new Date();
    grant.status = GrantStatus.REDEEMED;
    await updateGrantInSheet(grant);
    return response.status(200).json('');
  } catch (error) {
    console.error('Error redeeming grant:', error);
    return response.status(500).json({ message: 'Failed to redeem grant' });
  }
}
