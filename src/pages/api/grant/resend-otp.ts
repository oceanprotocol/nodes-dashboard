import { sendOTP } from '@/api-services/email';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import { GrantStatus } from '@/types/grant';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  const RESEND_COOLDOWN_MS = 60 * 1000;

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant || grant.status !== GrantStatus.PENDING) {
      // Generic 200 to avoid wallet enumeration — same shape as cooldown branch
      return response.status(200).json({ sent: false });
    }

    if (grant.otpLastResent && Date.now() - grant.otpLastResent < RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - grant.otpLastResent)) / 1000);
      return response.status(200).json({ sent: false, retryAfter: remainingSeconds });
    }

    // Generate new OTP. Do NOT reset otpAttempts — prevents bypassing lockout via repeated resends.
    const { otp, otpExpires } = generateOTP();

    const updated = await updateGrantInSheet({
      ...grant,
      otp: hashOTP(otp),
      otpExpires,
      otpLastResent: Date.now(),
    });
    if (!updated) {
      return response.status(500).json({ message: 'Failed to resend code' });
    }

    // Send OTP via email
    await sendOTP(grant.email, otp);

    return response.status(200).json({ sent: true });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return response.status(500).json({ message: 'Failed to resend code' });
  }
}
