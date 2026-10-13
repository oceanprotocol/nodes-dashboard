import { findGrantInSheet } from '@/api-services/gsheets';
import { GRANT_MAX_OTP_ATTEMPTS, GrantStatus, GrantStatusResponse, GrantWithStatus } from '@/types/grant';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return '';
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function toStatusResponse(grant: GrantWithStatus): GrantStatusResponse {
  const isPending = grant.status === GrantStatus.PENDING;
  return {
    applicationDate: grant.applicationDate.toISOString(),
    claimDate: grant.claimDate?.toISOString(),
    maskedEmail: maskEmail(grant.email),
    otpExpires: isPending ? grant.otpExpires : undefined,
    otpLastResent: isPending ? grant.otpLastResent : undefined,
    otpLocked: isPending ? (grant.otpAttempts ?? 0) >= GRANT_MAX_OTP_ATTEMPTS : undefined,
    status: grant.status,
    verifiedDate: grant.verifiedDate?.toISOString(),
  };
}

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
      const body: GrantStatusResponse = { status: null };
      return response.status(200).json(body);
    }

    return response.status(200).json(toStatusResponse(grant));
  } catch (error) {
    console.error('Error getting grant status:', error);
    return response.status(500).json({ message: 'Failed to get grant status' });
  }
}
