import { sendOTP } from '@/api-services/email';
import { validateSubsidyDataWithAI } from '@/api-services/gemini';
import {
  findSubsidiesByHandles,
  findSubsidyByEmail,
  findSubsidyByWallet,
  insertSubsidyInSheet,
  isStalePendingSubsidy,
  loadSubsidies,
  SubsidyRecord,
  updateSubsidyInSheet,
} from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import { allowMethod, isWalletAddress, parseBody } from '@/api-services/request';
import { subsidyDetailsBodySchema } from '@/api-services/subsidy-schemas';
import {
  isValidHandle,
  normalizeHandles,
  SubmitSubsidyDetailsResponse,
  SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS,
  SubsidyDetails,
  SubsidyHandleService,
  SubsidyStatus,
} from '@/types/subsidy';
import { isBlacklistedEmail, normalizeEmail } from '@/utils/email';
import type { NextApiRequest, NextApiResponse } from 'next';

const RESEND_COOLDOWN_MS = SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS * 1000;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (!allowMethod(request, response, 'POST')) {
    return;
  }

  const data = await parseBody(request, response, subsidyDetailsBodySchema);
  if (!data) {
    return;
  }

  // Input validation
  const nameRegex = /^[\p{L}\s.'-]{1,100}$/u;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!isWalletAddress(data.walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  if (!nameRegex.test(data.name)) {
    return response.status(400).json({ message: 'Invalid name format or length' });
  }

  if (!emailRegex.test(data.email) || data.email.length > 255) {
    return response.status(400).json({ message: 'Invalid email address' });
  }

  data.email = normalizeEmail(data.email);

  if (isBlacklistedEmail(data.email)) {
    return response.status(400).json({
      message:
        'We can’t offer the subsidy to this email address. Try another email, or contact support at help@oncompute.ai and we’ll take a look.',
    });
  }

  data.handles = normalizeHandles(data.handles);

  const handleEntries = Object.entries(data.handles) as Array<[SubsidyHandleService, string]>;
  if (handleEntries.length === 0) {
    return response.status(400).json({ message: 'At least one handle is required' });
  }

  if (handleEntries.some(([service, handle]) => !isValidHandle(handle, service))) {
    return response.status(400).json({ message: 'Invalid handle format or length' });
  }

  const details: SubsidyDetails = {
    email: data.email,
    handles: data.handles,
    name: data.name,
    walletAddress: data.walletAddress,
  };

  let existingSubsidy: SubsidyRecord | null = null;
  // Existence checks run BEFORE the (paid) Gemini call so spammers can't burn AI quota
  // by re-submitting against already-CLAIMED / already-verified rows.
  try {
    const subsidies = await loadSubsidies();
    const byWallet = findSubsidyByWallet(subsidies, details.walletAddress);
    const byEmail = findSubsidyByEmail(subsidies, details.email);
    const isOtherApplicant = (subsidy: SubsidyRecord) =>
      subsidy.walletAddress.toLowerCase() !== details.walletAddress.toLowerCase() && !isStalePendingSubsidy(subsidy);

    // Pending rows may change email, so a wallet can't be squatted before verification.
    if (
      byWallet &&
      byWallet.email.toLowerCase() !== details.email.toLowerCase() &&
      byWallet.status !== SubsidyStatus.PENDING
    ) {
      return response.status(403).json({ message: 'Wallet address already associated with another account' });
    }

    // An unverified email doesn't reserve it: whoever controls the inbox wins at /verify.
    if (byEmail && isOtherApplicant(byEmail) && (byEmail.status !== SubsidyStatus.PENDING || byWallet)) {
      return response.status(403).json({ message: 'Email already associated with another account' });
    }

    // Unlike wallets, a handle held by another active applicant can't be taken over.
    if (
      findSubsidiesByHandles(subsidies, details.handles).some(
        (byHandle) => isOtherApplicant(byHandle) && byHandle.email.toLowerCase() !== details.email.toLowerCase()
      )
    ) {
      return response.status(403).json({ message: 'Handle already associated with another account' });
    }

    // Without a row of its own, the wallet takes over a stale application for the same email.
    existingSubsidy = byWallet ?? byEmail;

    if (existingSubsidy) {
      if (existingSubsidy.status === SubsidyStatus.CLAIMED) {
        return response.status(403).json({ message: 'Subsidy already claimed' });
      }

      // Verified details are frozen; anyone who knows the wallet and email could otherwise rewrite them.
      if (existingSubsidy.status === SubsidyStatus.EMAIL_VERIFIED) {
        const responseData: SubmitSubsidyDetailsResponse = {
          shouldValidateEmail: false,
        };
        return response.status(200).json(responseData);
      }

      const sinceLastSent = Date.now() - (existingSubsidy.otpLastResent ?? 0);
      if (sinceLastSent < RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - sinceLastSent) / 1000);
        return response
          .status(429)
          .json({ message: `A code was just sent. Try again in ${remainingSeconds} seconds.` });
      }
    }
  } catch (error) {
    console.error('Error checking existing subsidy:', error);
    return response.status(500).json({ message: 'Failed to process subsidy details' });
  }

  const validationResult = await validateSubsidyDataWithAI(details);
  if (!validationResult.available) {
    return response.status(503).json({ message: 'Validation service unavailable. Please try again later.' });
  }
  if (!validationResult.valid) {
    console.warn(`Subsidy details rejected for ${details.walletAddress}: ${validationResult.reason}`);
    return response
      .status(400)
      .json({ message: "We couldn't verify these details. Check your name, email and handles, then try again." });
  }

  const { otp, otpExpires } = generateOTP();
  const otpHash = hashOTP(otp);
  try {
    if (existingSubsidy) {
      const isTakeover = existingSubsidy.walletAddress.toLowerCase() !== details.walletAddress.toLowerCase();
      await updateSubsidyInSheet(existingSubsidy.rowNumber, {
        ...existingSubsidy,
        ...details,
        applicationDate: isTakeover ? new Date() : existingSubsidy.applicationDate,
        otp: otpHash,
        otpAttempts: 0,
        otpExpires,
        otpLastResent: Date.now(),
        status: SubsidyStatus.PENDING,
        verifiedDate: undefined,
      });
    } else {
      await insertSubsidyInSheet({ ...details, otp: otpHash, otpAttempts: 0, otpExpires, otpLastResent: Date.now() });
    }
  } catch (error) {
    console.error('Error saving subsidy details:', error);
    return response.status(500).json({ message: 'Failed to process subsidy details' });
  }

  try {
    await sendOTP(details.email, otp);
    const responseData: SubmitSubsidyDetailsResponse = {
      shouldValidateEmail: true,
    };
    return response.status(200).json(responseData);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
