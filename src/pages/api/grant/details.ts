import { validateGrantDataWithAI } from '@/api-services/gemini';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantDetails, GrantStatus } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory storage for OTPs (In production, use Redis or a DB)
// Using a global variable for persistence across hot-reloads in dev
const globalAny: any = global;
globalAny.otpStore = globalAny.otpStore || new Map<string, { code: string; data: GrantDetails; expires: number }>();

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
  const existingGrant = await findGrantInSheet(data.email);
  if (existingGrant) {
    if (existingGrant.status === GrantStatus.REDEEMED) {
      // Grant already redeemed, return error
      return response.status(403).json({ message: 'Grant already redeemed' });
    }
    if (existingGrant.status === GrantStatus.NOT_REDEEMED) {
      // Grant already exists but not redeemed
      try {
        // Update grant in sheet with new data
        const newGrant = { ...existingGrant, ...data };
        await updateGrantInSheet(newGrant);
        return response.status(200).json({ shouldValidateEmail: false });
      } catch (error) {
        return response.status(500).json({ message: 'Failed to save grant details' });
      }
    }
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  globalAny.otpStore.set(data.email, { code: otp, data, expires });

  // Send OTP via email
  try {
    // TODO
    // await sendOTP(data.email, otp);
    return response.status(200).json({
      shouldValidateEmail: true,
      // TODO remove OTP from response
      otp,
    });
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
