import { sendOTP } from '@/api-services/email';
import { validateGrantDataWithAI } from '@/api-services/gemini';
import { getGrantStore, initializeGrantStore } from '@/api-services/grant-store';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP } from '@/api-services/otp';
import { GrantDetails, GrantStatus, SubmitGrantDetailsResponse } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

initializeGrantStore();

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

  // AI validation
  const validationResult = await validateGrantDataWithAI(data);
  if (!validationResult.valid) {
    return response.status(400).json({ message: `Validation failed: ${validationResult.reason}` });
  }

  // Check if grant already exists
  try {
    const existingGrant = await findGrantInSheet({ email: data.email });
    if (existingGrant) {
      const newGrant = { ...existingGrant, ...data };
      switch (existingGrant.status) {
        case GrantStatus.EMAIL_VERIFIED:
        case GrantStatus.SIGNED_FAUCET_MESSAGE: {
          // Grant already exists, reward not claimed
          // => Update details and continue with claiming
          await updateGrantInSheet(newGrant);
          const responseData: SubmitGrantDetailsResponse = {
            shouldValidateEmail: false,
          };
          return response.status(200).json(responseData);
        }
        case GrantStatus.CLAIMED: {
          // Grant already claimed
          // => Return error
          return response.status(403).json({ message: 'Grant already claimed' });
        }
      }
    }
  } catch (error) {
    return response.status(500).json({ message: 'Failed to process grant details' });
  }

  // Generate OTP
  const { otp, otpExpires } = generateOTP();
  getGrantStore().set(data.email, { otp, otpExpires, data });

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
