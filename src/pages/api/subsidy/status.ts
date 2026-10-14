import { findSubsidyInSheet } from '@/api-services/gsheets';
import { SUBSIDY_MAX_OTP_ATTEMPTS, SubsidyStatus, SubsidyStatusResponse, SubsidyWithStatus } from '@/types/subsidy';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return '';
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function toStatusResponse(subsidy: SubsidyWithStatus): SubsidyStatusResponse {
  const isPending = subsidy.status === SubsidyStatus.PENDING;
  return {
    applicationDate: subsidy.applicationDate.toISOString(),
    claimDate: subsidy.claimDate?.toISOString(),
    maskedEmail: maskEmail(subsidy.email),
    otpExpires: isPending ? subsidy.otpExpires : undefined,
    otpLastResent: isPending ? subsidy.otpLastResent : undefined,
    otpLocked: isPending ? (subsidy.otpAttempts ?? 0) >= SUBSIDY_MAX_OTP_ATTEMPTS : undefined,
    status: subsidy.status,
    verifiedDate: subsidy.verifiedDate?.toISOString(),
  };
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'GET') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  response.setHeader('Cache-Control', 'no-store');

  const { walletAddress } = request.query;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  try {
    const subsidy = await findSubsidyInSheet({ walletAddress });
    if (!subsidy) {
      const body: SubsidyStatusResponse = { status: null };
      return response.status(200).json(body);
    }

    return response.status(200).json(toStatusResponse(subsidy));
  } catch (error) {
    console.error('Error getting subsidy status:', error);
    return response.status(500).json({ message: 'Failed to get subsidy status' });
  }
}
