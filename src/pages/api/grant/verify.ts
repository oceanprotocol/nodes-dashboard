import { getGrantStore } from '@/api-services/grant-store';
import { insertGrantInSheet } from '@/api-services/gsheets';
import type { NextApiRequest, NextApiResponse } from 'next';

const grantStore = getGrantStore();

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { email, code } = request.body;

  if (!email || !code) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  const storedGrant = grantStore?.get(email);

  if (!storedGrant || storedGrant.otp !== code) {
    return response.status(400).json({ message: 'Invalid code' });
  }

  if (Date.now() > storedGrant.otpExpires) {
    grantStore.delete(email);
    return response.status(400).json({ message: 'Code expired' });
  }

  // OTP is valid
  try {
    await insertGrantInSheet(storedGrant.data);
    grantStore.delete(email);
  } catch (error) {
    console.error('Error inserting grant in sheet:', error);
    return response.status(500).json({ message: 'Failed to save grant data' });
  }

  return response.status(200).json('');
}
