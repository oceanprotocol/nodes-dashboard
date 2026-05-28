import { isGrantRedeemedOnChain } from '@/api-services/faucet';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantStatus } from '@/types/grant';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  // Disable caching so transient status (PENDING/EMAIL_VERIFIED) isn't served stale to other clients
  response.setHeader('Cache-Control', 'no-store');

  const { walletAddress } = request.query;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });
    if (!grant) {
      return response.status(200).json({ status: null });
    }

    // Self-heal: a SIGNED row whose nonce was already consumed on-chain means
    // the claim succeeded but /confirm never landed. Advance to CLAIMED so the
    // UI stops offering a redundant claim button.
    if (grant.status === GrantStatus.SIGNED_FAUCET_MESSAGE && grant.nonce !== undefined) {
      try {
        const redeemed = await isGrantRedeemedOnChain(grant.walletAddress, grant.nonce);
        if (redeemed) {
          await updateGrantInSheet({
            ...grant,
            claimDate: grant.claimDate ?? new Date(),
            nonce: undefined,
            signedFaucetMessage: undefined,
            status: GrantStatus.CLAIMED,
          });
          return response.status(200).json({ status: GrantStatus.CLAIMED });
        }
      } catch (error) {
        console.error('On-chain reconcile read failed in /status:', error);
      }
    }

    return response.status(200).json({ status: grant.status });
  } catch (error) {
    console.error('Error getting grant status:', error);
    return response.status(500).json({ message: 'Failed to get grant status' });
  }
}
