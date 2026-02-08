import { sendOTP } from '@/api-services/email';
import { getGrantStore } from '@/api-services/grant-store';
import { generateOTP } from '@/api-services/otp';
import type { NextApiRequest, NextApiResponse } from 'next';

const grantStore = getGrantStore();

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { email } = request.body;

  if (!email) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  const storedGrant = grantStore?.get(email);

  if (!storedGrant) {
    return response.status(400).json({ message: 'No pending grant found for this email' });
  }

  // Generate OTP
  const { otp, otpExpires } = generateOTP();
  getGrantStore().set(email, { otp, otpExpires, data: storedGrant.data });

  // Send OTP via email
  try {
    await sendOTP(email, otp);
    return response.status(200).json('');
  } catch (error) {
    return response.status(500).json({ message: 'Failed to send OTP' });
  }
}
