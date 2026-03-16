import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantStatus } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, code } = request.body;

  if (!walletAddress || !code) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant) {
      return response.status(400).json({ message: 'No pending grant found' });
    }

    if (grant.otp !== code) {
      return response.status(400).json({ message: 'Invalid code' });
    }

    if (grant.otpExpires && Date.now() > grant.otpExpires) {
      return response.status(400).json({ message: 'Code expired' });
    }

    // OTP is valid, update status and clear OTP fields
    await updateGrantInSheet({
      ...grant,
      status: GrantStatus.EMAIL_VERIFIED,
      otp: '',
      otpExpires: 0,
    });

    return response.status(200).json('');
  } catch (error) {
    console.error('Error verifying grant:', error);
    return response.status(500).json({ message: 'Failed to verify code' });
  }
}
