import { findSubsidyByWallet, loadSubsidies, updateSubsidyInSheet } from '@/api-services/gsheets';
import { verifyOTP } from '@/api-services/otp';
import { allowMethod, isWalletAddress } from '@/api-services/request';
import {
  SUBSIDY_MAX_OTP_ATTEMPTS,
  SubsidyStatus,
  SubsidyVerifyError,
  SubsidyVerifyErrorResponse,
} from '@/types/subsidy';
import { normalizeEmail } from '@/utils/email';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (!allowMethod(request, response, 'POST')) {
    return;
  }

  const { walletAddress, email, code } = request.body;

  if (!isWalletAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  // Optional: another device only knows the masked email.
  if (email !== undefined && (typeof email !== 'string' || email.length > 255)) {
    return response.status(400).json({ message: 'Invalid email' });
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return response.status(400).json({ message: 'Invalid code format' });
  }

  try {
    const subsidy = findSubsidyByWallet(await loadSubsidies(), walletAddress);

    if (
      !subsidy ||
      subsidy.status !== SubsidyStatus.PENDING ||
      (email && subsidy.email.toLowerCase() !== normalizeEmail(email).toLowerCase())
    ) {
      return response.status(400).json({ message: 'No pending subsidy request found' });
    }

    if (subsidy.otpExpires && Date.now() > subsidy.otpExpires) {
      const body: SubsidyVerifyErrorResponse = { error: SubsidyVerifyError.EXPIRED, message: 'Code expired' };
      return response.status(400).json(body);
    }

    if ((subsidy.otpAttempts ?? 0) >= SUBSIDY_MAX_OTP_ATTEMPTS) {
      const body: SubsidyVerifyErrorResponse = {
        error: SubsidyVerifyError.LOCKED,
        message: 'Too many attempts. Request a new code.',
      };
      return response.status(429).json(body);
    }

    // Increment before comparing to narrow the concurrent-guess race.
    const nextAttempts = (subsidy.otpAttempts ?? 0) + 1;
    await updateSubsidyInSheet(subsidy.rowNumber, { ...subsidy, otpAttempts: nextAttempts });

    if (!verifyOTP(code, subsidy.otp ?? '')) {
      const attemptsLeft = Math.max(0, SUBSIDY_MAX_OTP_ATTEMPTS - nextAttempts);
      const body: SubsidyVerifyErrorResponse = attemptsLeft
        ? { attemptsLeft, error: SubsidyVerifyError.INVALID_CODE, message: 'Invalid code' }
        : { error: SubsidyVerifyError.LOCKED, message: 'Too many attempts. Request a new code.' };
      return response.status(400).json(body);
    }

    await updateSubsidyInSheet(subsidy.rowNumber, {
      ...subsidy,
      status: SubsidyStatus.EMAIL_VERIFIED,
      otp: '',
      otpAttempts: 0,
      otpExpires: 0,
      verifiedDate: new Date(),
    });

    return response.status(200).json('');
  } catch (error) {
    console.error('Error verifying subsidy:', error);
    return response.status(500).json({ message: 'Failed to verify code' });
  }
}
