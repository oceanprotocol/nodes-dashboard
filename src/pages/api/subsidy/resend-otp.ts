import { sendOTP } from '@/api-services/email';
import {
  findSubsidyByWallet,
  isStalePendingSubsidy,
  loadSubsidies,
  updateSubsidyInSheet,
} from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import { allowMethod, isWalletAddress } from '@/api-services/request';
import { SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS, SubsidyStatus } from '@/types/subsidy';
import type { NextApiRequest, NextApiResponse } from 'next';

const RESEND_COOLDOWN_MS = SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS * 1000;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (!allowMethod(request, response, 'POST')) {
    return;
  }

  const { walletAddress } = request.body;

  if (!isWalletAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  try {
    const subsidy = findSubsidyByWallet(await loadSubsidies(), walletAddress);

    if (!subsidy || subsidy.status !== SubsidyStatus.PENDING) {
      // Generic 200 to avoid wallet enumeration — same shape as cooldown branch
      return response.status(200).json({ sent: false });
    }

    if (isStalePendingSubsidy(subsidy)) {
      return response.status(400).json({ message: 'Your request expired. Submit your details again.' });
    }

    const now = Date.now();
    if (subsidy.otpLastResent && now - subsidy.otpLastResent < RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - subsidy.otpLastResent)) / 1000);
      return response.status(200).json({ sent: false, retryAfter: remainingSeconds });
    }

    // Resets attempts; the cooldown rate-limits guessing.
    const { otp, otpExpires } = generateOTP();

    await updateSubsidyInSheet(subsidy.rowNumber, {
      ...subsidy,
      otp: hashOTP(otp),
      otpAttempts: 0,
      otpExpires,
      otpLastResent: now,
    });

    await sendOTP(subsidy.email, otp);

    return response.status(200).json({ otpExpires, sent: true });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return response.status(500).json({ message: 'Failed to resend code' });
  }
}
