import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { verifyOTP } from '@/api-services/otp';
import { GrantStatus } from '@/types/grant';
import { normalizeEmail } from '@/utils/email';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_OTP_ATTEMPTS = 5;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, email, code } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  if (!email || typeof email !== 'string' || email.length > 255) {
    return response.status(400).json({ message: 'Invalid email' });
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return response.status(400).json({ message: 'Invalid code format' });
  }

  try {
    const [grantByWallet, grantByEmail] = await Promise.all([
      findGrantInSheet({ walletAddress }),
      findGrantInSheet({ email: normalizeEmail(email) }),
    ]);

    // Both lookups must resolve to the same row
    if (
      !grantByWallet ||
      !grantByEmail ||
      grantByWallet.walletAddress.toLowerCase() !== grantByEmail.walletAddress.toLowerCase() ||
      grantByWallet.email.toLowerCase() !== grantByEmail.email.toLowerCase()
    ) {
      return response.status(400).json({ message: 'No pending grant found' });
    }

    const grant = grantByWallet;

    // Only PENDING grants are eligible for OTP verification. Reject calls on already-verified/ signed/ claimed rows
    if (grant.status !== GrantStatus.PENDING) {
      return response.status(400).json({ message: 'No pending grant found' });
    }

    if (grant.otpExpires && Date.now() > grant.otpExpires) {
      return response.status(400).json({ message: 'Code expired' });
    }

    if ((grant.otpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      return response.status(429).json({ message: 'Too many attempts. Request a new code.' });
    }

    // Pre-increment the attempt counter BEFORE the comparison.
    // Reduces the race window where concurrent guesses could share the same pre-check value.
    const nextAttempts = (grant.otpAttempts ?? 0) + 1;
    const incremented = await updateGrantInSheet({ ...grant, otpAttempts: nextAttempts });
    if (!incremented) {
      return response.status(500).json({ message: 'Failed to verify code' });
    }

    if (!verifyOTP(code, grant.otp ?? '')) {
      return response.status(400).json({ message: 'Invalid code' });
    }

    // OTP is valid, update status and clear OTP fields
    await updateGrantInSheet({
      ...grant,
      status: GrantStatus.EMAIL_VERIFIED,
      otp: '',
      otpAttempts: 0,
      otpExpires: 0,
    });

    return response.status(200).json('');
  } catch (error) {
    console.error('Error verifying grant:', error);
    return response.status(500).json({ message: 'Failed to verify code' });
  }
}
