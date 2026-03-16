import { sendOTP } from '@/api-services/email';
import { validateGrantDataWithAI } from '@/api-services/gemini';
import { findGrantInSheet, insertGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP } from '@/api-services/otp';
import { GrantDetails, GrantStatus, GrantWithStatus, SubmitGrantDetailsResponse } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const data: GrantDetails = request.body;

  // Check for missing fields
  if (
    !data.email ||
    !data.goal ||
    !data.handle ||
    !data.hardware ||
    !data.name ||
    !data.os ||
    !data.role ||
    !data.walletAddress
  ) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  // Input validation
  const nameRegex = /^[\p{L}\s.'-]{1,100}$/u;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const handleRegex = /^[a-zA-Z0-9@\._\-]{1,100}$/;

  if (!nameRegex.test(data.name)) {
    return response.status(400).json({ message: 'Invalid name format or length' });
  }

  if (!emailRegex.test(data.email) || data.email.length > 255) {
    return response.status(400).json({ message: 'Invalid email format or length' });
  }

  if (!handleRegex.test(data.handle)) {
    return response.status(400).json({ message: 'Invalid handle format or length' });
  }

  // AI validation
  const validationResult = await validateGrantDataWithAI(data);
  if (!validationResult.valid) {
    return response.status(400).json({ message: `Validation failed: ${validationResult.reason}` });
  }

  let existingGrant: GrantWithStatus | null = null;
  // Check if grant already exists
  try {
    existingGrant = await findGrantInSheet({ email: data.email });
    if (existingGrant) {
      if (existingGrant.status === GrantStatus.CLAIMED) {
        return response.status(403).json({ message: 'Grant already claimed' });
      }

      if (
        existingGrant.status === GrantStatus.EMAIL_VERIFIED ||
        existingGrant.status === GrantStatus.SIGNED_FAUCET_MESSAGE
      ) {
        // Grant already exists and is verified
        // => Update details and continue with claiming
        await updateGrantInSheet({ ...existingGrant, ...data });
        const responseData: SubmitGrantDetailsResponse = {
          shouldValidateEmail: false,
        };
        return response.status(200).json(responseData);
      }
    }
  } catch (error) {
    console.error('Error checking existing grant:', error);
    // Continue anyway, maybe it's just a temporary sheet error
  }

  // Generate OTP and save with grant details
  const { otp, otpExpires } = generateOTP();
  try {
    if (existingGrant) {
      await updateGrantInSheet({ ...existingGrant, ...data, otp, otpExpires });
    } else {
      await insertGrantInSheet({ ...data, otp, otpExpires });
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
