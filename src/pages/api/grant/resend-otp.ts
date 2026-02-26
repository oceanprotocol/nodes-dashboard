// import { sendOTP } from '@/api-services/email';
// import { getGrantStore } from '@/api-services/grant-store';
// import { generateOTP } from '@/api-services/otp';
import type { NextApiRequest, NextApiResponse } from 'next';

// TODO re-enable grants
// const grantStore = getGrantStore();

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  // TODO re-enable grants
  return response.status(403).json({ message: 'Grants are not available at the moment' });

  // if (request.method !== 'POST') {
  //   return response.status(405).json({ message: 'Method not allowed' });
  // }

  // const { walletAddress } = request.body;

  // if (!walletAddress) {
  //   return response.status(400).json({ message: 'Missing required fields' });
  // }

  // const storedGrant = grantStore?.get(walletAddress);

  // if (!storedGrant) {
  //   return response.status(400).json({ message: 'No pending grant found for this wallet address' });
  // }

  // // Generate OTP
  // const { otp, otpExpires } = generateOTP();
  // getGrantStore().set(walletAddress, { otp, otpExpires, data: storedGrant.data });

  // // Send OTP via email
  // try {
  //   await sendOTP(storedGrant.data.email, otp);
  //   return response.status(200).json('');
  // } catch (error) {
  //   return response.status(500).json({ message: 'Failed to send OTP' });
  // }
}
