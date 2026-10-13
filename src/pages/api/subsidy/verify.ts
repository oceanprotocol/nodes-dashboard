import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { verifyOTP } from '@/api-services/otp';
import { GRANT_MAX_OTP_ATTEMPTS, GrantStatus, GrantVerifyError, GrantVerifyErrorResponse } from '@/types/grant';
import { normalizeEmail } from '@/utils/email';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, email, code } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  // Optional: a user resuming on another device only knows the masked email from /status.
  if (email !== undefined && (typeof email !== 'string' || email.length > 255)) {
    return response.status(400).json({ message: 'Invalid email' });
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return response.status(400).json({ message: 'Invalid code format' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant || (email && grant.email.toLowerCase() !== normalizeEmail(email).toLowerCase())) {
      return response.status(400).json({ message: 'No pending subsidy request found' });
    }

    // Only PENDING grants are eligible for OTP verification. Reject calls on already-verified/ signed/ claimed rows
    if (grant.status !== GrantStatus.PENDING) {
      return response.status(400).json({ message: 'No pending subsidy request found' });
    }

    if (grant.otpExpires && Date.now() > grant.otpExpires) {
      const body: GrantVerifyErrorResponse = { error: GrantVerifyError.EXPIRED, message: 'Code expired' };
      return response.status(400).json(body);
    }

    if ((grant.otpAttempts ?? 0) >= GRANT_MAX_OTP_ATTEMPTS) {
      const body: GrantVerifyErrorResponse = {
        error: GrantVerifyError.LOCKED,
        message: 'Too many attempts. Request a new code.',
      };
      return response.status(429).json(body);
    }

    // Pre-increment the attempt counter BEFORE the comparison.
    // Reduces the race window where concurrent guesses could share the same pre-check value.
    const nextAttempts = (grant.otpAttempts ?? 0) + 1;
    const incremented = await updateGrantInSheet({ ...grant, otpAttempts: nextAttempts });
    if (!incremented) {
      return response.status(500).json({ message: 'Failed to verify code' });
    }

    if (!verifyOTP(code, grant.otp ?? '')) {
      const attemptsLeft = Math.max(0, GRANT_MAX_OTP_ATTEMPTS - nextAttempts);
      const body: GrantVerifyErrorResponse = attemptsLeft
        ? { attemptsLeft, error: GrantVerifyError.INVALID_CODE, message: 'Invalid code' }
        : { error: GrantVerifyError.LOCKED, message: 'Too many attempts. Request a new code.' };
      return response.status(400).json(body);
    }

    // OTP is valid, update status and clear OTP fields
    await updateGrantInSheet({
      ...grant,
      status: GrantStatus.EMAIL_VERIFIED,
      otp: '',
      otpAttempts: 0,
      otpExpires: 0,
      verifiedDate: new Date(),
    });

    return response.status(200).json('');
  } catch (error) {
    console.error('Error verifying grant:', error);
    return response.status(500).json({ message: 'Failed to verify code' });
  }
}
