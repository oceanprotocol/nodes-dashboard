import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantStatus } from '@/types/grant';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Marks a verified request as claimed. Adding the wallet to the subsidy contract's access list
 * happens outside the dashboard.
 */
export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Wallet address is missing or invalid' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant || grant.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return response.status(404).json({ message: 'Subsidy request not found' });
    }

    if (grant.status === GrantStatus.CLAIMED) {
      return response.status(200).json({ status: GrantStatus.CLAIMED });
    }

    if (grant.status !== GrantStatus.EMAIL_VERIFIED) {
      return response.status(400).json({ message: 'Verify your email before claiming' });
    }

    const updated = await updateGrantInSheet({
      ...grant,
      claimDate: new Date(),
      status: GrantStatus.CLAIMED,
    });
    if (!updated) {
      return response.status(500).json({ message: 'Failed to claim subsidy' });
    }

    return response.status(200).json({ status: GrantStatus.CLAIMED });
  } catch (error) {
    console.error('Error claiming subsidy:', error);
    return response.status(500).json({ message: 'Failed to claim subsidy' });
  }
}
