import { sendOTP } from '@/api-services/email';
import { validateSubsidyDataWithAI } from '@/api-services/gemini';
import {
  findSubsidiesByHandles,
  findSubsidyInSheet,
  insertSubsidyInSheet,
  updateSubsidyInSheet,
} from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import {
  isValidHandle,
  normalizeHandles,
  SubmitSubsidyDetailsResponse,
  SubsidyDetails,
  SubsidyHandleService,
  SubsidyStatus,
  SubsidyWithStatus,
} from '@/types/subsidy';
import { isBlacklistedEmail, normalizeEmail } from '@/utils/email';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const data: SubsidyDetails = request.body;

  // Check for missing fields + enforce string-type to prevent type-confusion attacks
  const requiredStringFields: Array<keyof SubsidyDetails> = ['email', 'name', 'walletAddress'];
  for (const field of requiredStringFields) {
    if (!data[field] || typeof data[field] !== 'string') {
      return response.status(400).json({ message: 'Missing required fields' });
    }
  }

  // Input validation
  const nameRegex = /^[\p{L}\s.'-]{1,100}$/u;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!ethers.isAddress(data.walletAddress)) {
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
    return response.status(400).json({ message: 'Invalid email address' });
  }

  if (!data.handles || typeof data.handles !== 'object' || Array.isArray(data.handles)) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  data.handles = normalizeHandles(data.handles);

  const handleEntries = Object.entries(data.handles) as Array<[SubsidyHandleService, string]>;
  if (handleEntries.length === 0) {
    return response.status(400).json({ message: 'At least one handle is required' });
  }

  if (handleEntries.some(([service, handle]) => !isValidHandle(handle, service))) {
    return response.status(400).json({ message: 'Invalid handle format or length' });
  }

  let existingSubsidy: SubsidyWithStatus | null = null;
  let emailChanged = false;
  // Existence checks run BEFORE the (paid) Gemini call so spammers can't burn AI quota
  // by re-submitting against already-CLAIMED / already-verified rows.
  try {
    const [byEmail, byWallet, byHandles] = await Promise.all([
      findSubsidyInSheet({ email: data.email }),
      findSubsidyInSheet({ walletAddress: data.walletAddress }),
      findSubsidiesByHandles(data.handles),
    ]);

    // Unclaimed rows may change email, so a wallet can't be squatted.
    if (
      byWallet &&
      byWallet.email.toLowerCase() !== data.email.toLowerCase() &&
      byWallet.status === SubsidyStatus.CLAIMED
    ) {
      return response.status(403).json({ message: 'Wallet address already associated with another account' });
    }

    // Reject submissions that target a foreign email's row — prevents OTP email bombing of third parties
    if (byEmail && byEmail.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Email already associated with another account' });
    }

    // Unlike wallets, a foreign handle can't be taken over.
    if (
      byHandles.some(
        (byHandle) =>
          byHandle.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase() &&
          byHandle.email.toLowerCase() !== data.email.toLowerCase()
      )
    ) {
      return response.status(403).json({ message: 'Handle already associated with another account' });
    }

    // Updates are keyed by walletAddress.
    existingSubsidy = byWallet ?? byEmail;
    emailChanged = !!existingSubsidy && existingSubsidy.email.toLowerCase() !== data.email.toLowerCase();

    if (existingSubsidy) {
      if (existingSubsidy.status === SubsidyStatus.CLAIMED) {
        return response.status(403).json({ message: 'Subsidy already claimed' });
      }

      if (
        existingSubsidy.status === SubsidyStatus.EMAIL_VERIFIED &&
        existingSubsidy.email.toLowerCase() === data.email.toLowerCase()
      ) {
        // Keep the verified identity so the subsidy can't be redirected.
        const updated = await updateSubsidyInSheet({
          ...existingSubsidy,
          ...data,
          email: existingSubsidy.email,
          walletAddress: existingSubsidy.walletAddress,
        });
        if (!updated) {
          return response.status(500).json({ message: 'Failed to process subsidy details' });
        }
        const responseData: SubmitSubsidyDetailsResponse = {
          shouldValidateEmail: false,
        };
        return response.status(200).json(responseData);
      }
    }
  } catch (error) {
    console.error('Error checking existing subsidy:', error);
    return response.status(500).json({ message: 'Failed to process subsidy details' });
  }

  const validationResult = await validateSubsidyDataWithAI(data);
  if (!validationResult.valid) {
    return response.status(400).json({ message: `Validation failed: ${validationResult.reason}` });
  }

  const { otp, otpExpires } = generateOTP();

  // Reset attempts on every new OTP issuance — a fresh code is a fresh session.

  const otpHash = hashOTP(otp);
  try {
    if (existingSubsidy) {
      // Update keyed by the existing walletAddress; data spreads first so other fields update.
      const updated = await updateSubsidyInSheet({
        ...existingSubsidy,
        ...data,
        walletAddress: existingSubsidy.walletAddress,
        otp: otpHash,
        otpAttempts: 0,
        otpExpires,
        otpLastResent: Date.now(),
        status: SubsidyStatus.PENDING,
        verifiedDate: undefined,
      });
      if (!updated) {
        return response.status(500).json({ message: 'Failed to process subsidy details' });
      }
    } else {
      await insertSubsidyInSheet({ ...data, otp: otpHash, otpAttempts: 0, otpExpires, otpLastResent: Date.now() });
    }
  } catch (error) {
    console.error('Error saving subsidy details:', error);
    return response.status(500).json({ message: 'Failed to process subsidy details' });
  }

  // Send OTP via email
  try {
    await sendOTP(data.email, otp);
    const responseData: SubmitSubsidyDetailsResponse = {
      emailChanged: emailChanged && existingSubsidy?.status === SubsidyStatus.EMAIL_VERIFIED,
      shouldValidateEmail: true,
    };
    return response.status(200).json(responseData);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
