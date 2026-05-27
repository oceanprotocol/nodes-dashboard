import { sendOTP } from '@/api-services/email';
import { validateGrantDataWithAI } from '@/api-services/gemini';
import { findGrantInSheet, insertGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP, hashOTP } from '@/api-services/otp';
import {
  GRANT_GOAL_CHOICES,
  GRANT_HARDWARE_CHOICES,
  GRANT_OS_CHOICES,
  GRANT_ROLE_CHOICES,
  GrantDetails,
  GrantStatus,
  GrantWithStatus,
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
  const requiredStringFields: Array<keyof GrantDetails> = [
    'email',
    'goal',
    'handle',
    'name',
    'os',
    'role',
    'walletAddress',
  ];
  for (const field of requiredStringFields) {
    if (!data[field] || typeof data[field] !== 'string') {
      return response.status(400).json({ message: 'Missing required fields' });
    }
  }
  if (
    !Array.isArray(data.hardware) ||
    data.hardware.length === 0 ||
    data.hardware.length > GRANT_HARDWARE_CHOICES.length ||
    !data.hardware.every((h) => typeof h === 'string')
  ) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  // Input validation
  const nameRegex = /^[\p{L}\s.'-]{1,100}$/u;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const handleRegex = /^[a-zA-Z0-9@\._\-]{1,100}$/;

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

  if (!isBlacklistedEmail(data.email)) {
    return response.status(400).json({ message: 'Invalid email address' });
  }

  if (!handleRegex.test(data.handle)) {
    return response.status(400).json({ message: 'Invalid handle format or length' });
  }

  const validRoles = GRANT_ROLE_CHOICES.map((c) => c.value);
  const validOs = GRANT_OS_CHOICES.map((c) => c.value);
  const validGoals = GRANT_GOAL_CHOICES.map((c) => c.value);
  const validHardware = GRANT_HARDWARE_CHOICES.map((c) => c.value);

  if (!validRoles.includes(data.role)) {
    return response.status(400).json({ message: 'Invalid role' });
  }
  if (!validOs.includes(data.os)) {
    return response.status(400).json({ message: 'Invalid OS' });
  }
  if (!validGoals.includes(data.goal)) {
    return response.status(400).json({ message: 'Invalid goal' });
  }
  if (
    !Array.isArray(data.hardware) ||
    data.hardware.length === 0 ||
    !data.hardware.every((h) => validHardware.includes(h))
  ) {
    return response.status(400).json({ message: 'Invalid hardware selection' });
  }

  let existingGrant: GrantWithStatus | null = null;
  // Check if grant already exists.
  // Existence checks run BEFORE the (paid) Gemini call so spammers can't burn AI quota
  // by re-submitting against already-CLAIMED / already-verified rows.
  try {
    const [byEmail, byWallet] = await Promise.all([
      findGrantInSheet({ email: data.email }),
      findGrantInSheet({ walletAddress: data.walletAddress }),
    ]);

    // Block wallet already registered under a different email — but only after email verification.
    // PENDING rows are overwritable to prevent wallet squatting denial-of-service.
    if (
      byWallet &&
      byWallet.email.toLowerCase() !== data.email.toLowerCase() &&
      byWallet.status !== GrantStatus.PENDING
    ) {
      return response.status(403).json({ message: 'Wallet address already associated with another account' });
    }

    // Reject submissions that target a foreign email's row — prevents OTP email bombing of third parties
    if (byEmail && byEmail.walletAddress.toLowerCase() !== data.walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Email already associated with another account' });
    }

    // Prefer wallet match over email match when both exist, so we update the row keyed by wallet
    // (updateGrantInSheet looks up by walletAddress).
    existingGrant = byWallet ?? byEmail;

    if (existingGrant) {
      if (existingGrant.status === GrantStatus.CLAIMED) {
        return response.status(403).json({ message: 'Complimentary credits already claimed' });
      }

      if (
        existingGrant.status === GrantStatus.EMAIL_VERIFIED ||
        existingGrant.status === GrantStatus.SIGNED_FAUCET_MESSAGE
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
      });
      if (!updated) {
        return response.status(500).json({ message: 'Failed to process grant details' });
      }
    } else {
      await insertGrantInSheet({ ...data, otp: otpHash, otpAttempts: 0, otpExpires });
    }
  } catch (error) {
    console.error('Error saving grant details:', error);
    return response.status(500).json({ message: 'Failed to process grant details' });
  }

  // Send OTP via email
  try {
    await sendOTP(data.email, otp);
    const responseData: SubmitGrantDetailsResponse = {
      shouldValidateEmail: true,
    };
    return response.status(200).json(responseData);
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
