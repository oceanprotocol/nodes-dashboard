import { sendOTP } from '@/api-services/email';
import { validateGrantDataWithAI } from '@/api-services/gemini';
import { findGrantByHandle, findGrantInSheet, insertGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import {
  GRANT_HANDLE_SERVICE_CHOICES,
  GrantDetails,
  GrantStatus,
  GrantWithStatus,
  isValidHandle,
  normalizeHandle,
  SubmitGrantDetailsResponse,
} from '@/types/grant';
import { isBlacklistedEmail, normalizeEmail } from '@/utils/email';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const data: GrantDetails = request.body;

  // Check for missing fields + enforce string-type to prevent type-confusion attacks
  const requiredStringFields: Array<keyof GrantDetails> = ['email', 'handle', 'handleService', 'name', 'walletAddress'];
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

  const validHandleServices = GRANT_HANDLE_SERVICE_CHOICES.map((c) => c.value);
  if (!validHandleServices.includes(data.handleService)) {
    return response.status(400).json({ message: 'Invalid handle service' });
  }

  data.handle = normalizeHandle(data.handle);

  if (!isValidHandle(data.handle, data.handleService)) {
    return response.status(400).json({ message: 'Invalid handle format or length' });
  }

  let existingGrant: GrantWithStatus | null = null;
  let emailChanged = false;
  // Check if grant already exists.
  // Existence checks run BEFORE the (paid) Gemini call so spammers can't burn AI quota
  // by re-submitting against already-CLAIMED / already-verified rows.
  try {
    const [byEmail, byWallet, byHandle] = await Promise.all([
      findGrantInSheet({ email: data.email }),
      findGrantInSheet({ walletAddress: data.walletAddress }),
      findGrantByHandle({ handle: data.handle, handleService: data.handleService }),
    ]);

    // Block wallet already registered under a different email once claimed. Unclaimed rows may change
    // their email: PENDING to prevent wallet squatting denial-of-service, verified ones go back to PENDING.
    if (
      byWallet &&
      byWallet.email.toLowerCase() !== data.email.toLowerCase() &&
      byWallet.status === GrantStatus.CLAIMED
    ) {
      return response.status(403).json({ message: 'Wallet address already associated with another account' });
    }

    // Reject submissions that target a foreign email's row — prevents OTP email bombing of third parties
    if (byEmail && byEmail.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Email already associated with another account' });
    }

    // One handle per service maps to one account. Same rule as the email check, and deliberately NOT
    // the wallet rule: a PENDING row keyed to someone else's wallet can be taken over (the update below
    // is keyed by wallet), but a foreign handle can't be — insertGrantInSheet would reject the duplicate.
    // So this has to block here, with a 403 that says why.
    if (
      byHandle &&
      byHandle.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase() &&
      byHandle.email.toLowerCase() !== data.email.toLowerCase()
    ) {
      return response.status(403).json({ message: 'Handle already associated with another account' });
    }

    // Prefer wallet match over email match when both exist, so we update the row keyed by wallet
    // (updateGrantInSheet looks up by walletAddress).
    existingGrant = byWallet ?? byEmail;
    emailChanged = !!existingGrant && existingGrant.email.toLowerCase() !== data.email.toLowerCase();

    if (existingGrant) {
      if (existingGrant.status === GrantStatus.CLAIMED) {
        return response.status(403).json({ message: 'Subsidy already claimed' });
      }

      // A verified email stays verified while it is unchanged. A new address needs its own code.
      if (
        existingGrant.status === GrantStatus.EMAIL_VERIFIED &&
        existingGrant.email.toLowerCase() === data.email.toLowerCase()
      ) {
        // Grant already exists and is verified
        // => Update details but preserve the verified walletAddress + email — prevents redirecting grant to a new wallet
        const updated = await updateGrantInSheet({
          ...existingGrant,
          ...data,
          email: existingGrant.email,
          walletAddress: existingGrant.walletAddress,
        });
        if (!updated) {
          return response.status(500).json({ message: 'Failed to process grant details' });
        }
        const responseData: SubmitGrantDetailsResponse = {
          shouldValidateEmail: false,
        };
        return response.status(200).json(responseData);
      }
    }
  } catch (error) {
    console.error('Error checking existing grant:', error);
    return response.status(500).json({ message: 'Failed to process grant details' });
  }

  const validationResult = await validateGrantDataWithAI(data);
  if (!validationResult.valid) {
    return response.status(400).json({ message: `Validation failed: ${validationResult.reason}` });
  }

  // Generate OTP and save with grant details
  const { otp, otpExpires } = generateOTP();

  // Reset attempts on every new OTP issuance — a fresh code is a fresh session.

  const otpHash = hashOTP(otp);
  try {
    if (existingGrant) {
      // Update keyed by the existing walletAddress; data spreads first so other fields update.
      const updated = await updateGrantInSheet({
        ...existingGrant,
        ...data,
        walletAddress: existingGrant.walletAddress,
        otp: otpHash,
        otpAttempts: 0,
        otpExpires,
        otpLastResent: Date.now(),
        status: GrantStatus.PENDING,
        verifiedDate: undefined,
      });
      if (!updated) {
        return response.status(500).json({ message: 'Failed to process grant details' });
      }
    } else {
      await insertGrantInSheet({ ...data, otp: otpHash, otpAttempts: 0, otpExpires, otpLastResent: Date.now() });
    }
  } catch (error) {
    console.error('Error saving grant details:', error);
    return response.status(500).json({ message: 'Failed to process grant details' });
  }

  // Send OTP via email
  try {
    await sendOTP(data.email, otp);
    const responseData: SubmitGrantDetailsResponse = {
      emailChanged: emailChanged && existingGrant?.status === GrantStatus.EMAIL_VERIFIED,
      shouldValidateEmail: true,
    };
    return response.status(200).json(responseData);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
