// import { exportToGSheets } from '@/api-services/gsheets';
import { insertGrantInSheet } from '@/api-services/gsheets';
import type { NextApiRequest, NextApiResponse } from 'next';

const globalAny: any = global;
const otpStore = globalAny.otpStore;

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { email, code } = request.body;

  if (!email || !code) {
    return response.status(400).json({ message: 'Missing required fields' });
  }

  const stored = otpStore?.get(email);

  if (!stored) {
    return response.status(400).json({ message: 'Invalid code' });
  }

  if (Date.now() > stored.expires) {
    otpStore.delete(email);
    return response.status(400).json({ message: 'Invalid code' });
  }

  if (stored.code !== code) {
    return response.status(400).json({ message: 'Invalid code' });
  }

  // OTP is valid!
  try {
    await insertGrantInSheet(stored.data);
  } catch (error) {
    console.error('Error inserting grant in sheet:', error);
    return response.status(500).json({ message: 'Failed to save grant data' });
  }

  return response.status(200).json('');

  // const userData = stored.data;
  // const grantAmount = '100000000000000000000'; // 100 OCEAN in wei (example)
  // const nonce = Date.now(); // Using timestamp as nonce
  // const contractAddress = process.env.GRANT_FAUCET_ADDRESS || '0x0';

  // try {
  //   // 1. Sign the message using the new format
  //   const signature = await signFaucetMessage(contractAddress, userData.walletAddress, nonce, grantAmount);

  //   // 2. Export to Google Sheets
  //   // await exportToGSheets({
  //   //   ...userData,
  //   //   grantAmount,
  //   //   nonce,
  //   //   signature,
  //   //   timestamp: new Date().toISOString(),
  //   // });

  //   // 3. Clean up OTP
  //   otpStore.delete(email);

  // 4. Return details to frontend
  // res.status(200).json({
  //   contract_address: contractAddress,
  //   nonce,
  //   amount: grantAmount,
  //   signature,
  // });
  // } catch (error: any) {
  //   console.error('Verification error:', error);
  //   res.status(500).json({ message: `Internal server error: ${error.message}` });
  // }
}
