import { sendOTP } from '@/api-services/email';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { generateOTP } from '@/api-services/otp';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.body;

  if (!walletAddress) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant) {
      return response.status(400).json({ message: 'No pending grant found' });
    }

    // Generate new OTP
    const { otp, otpExpires } = generateOTP();

    await updateGrantInSheet({
      ...grant,
      otp,
      otpExpires,
    });

    // Send OTP via email
    await sendOTP(grant.email, otp);

    return response.status(200).json('');
  } catch (error) {
    console.error('Error resending OTP:', error);
    return response.status(500).json({ message: 'Failed to resend code' });
  }
}
