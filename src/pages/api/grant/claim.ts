import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { signFaucetMessage } from '@/api-services/signer';
import { ClaimGrantResponse, GrantStatus } from '@/types/grant';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.body;

  if (!walletAddress) {
    return response.status(400).json({ message: 'Missing wallet address' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant) {
      return response.status(404).json({ message: 'Grant not found' });
    }

    if (grant.status === GrantStatus.CLAIMED) {
      return response.status(400).json({ message: 'Grant already claimed' });
    }

    const faucetAddress = process.env.GRANT_FAUCET_ADDRESS;

    if (grant.status === GrantStatus.SIGNED_FAUCET_MESSAGE) {
      if (!faucetAddress || !grant.rawAmount || !grant.nonce || !grant.signedFaucetMessage) {
        return response.status(500).json({ message: 'Failed to configure faucet' });
      }
      const responseData: ClaimGrantResponse = {
        faucetAddress,
        nonce: grant.nonce,
        rawAmount: grant.rawAmount,
        signature: grant.signedFaucetMessage,
        walletAddress: grant.walletAddress,
      };
      return response.status(200).json(responseData);
    }

    if (grant.status === GrantStatus.EMAIL_VERIFIED) {
      const amount = process.env.NEXT_PUBLIC_GRANT_AMOUNT;
      const faucetPrivateKey = process.env.GRANT_FAUCET_PRIVATE_KEY;
      const tokenAddress = process.env.NEXT_PUBLIC_GRANT_TOKEN_ADDRESS;
      const nonce = Date.now();
      if (!faucetAddress || !amount || !faucetPrivateKey || !tokenAddress) {
        return response.status(500).json({ message: 'Failed to configure faucet' });
      }
      const { signature, amount: rawAmount } = await signFaucetMessage({
        amount,
        faucetAddress,
        faucetPrivateKey,
        nonce,
        tokenAddress,
        walletAddress: grant.walletAddress,
      });
      updateGrantInSheet({
        ...grant,
        amount,
        rawAmount,
        nonce,
        signedFaucetMessage: signature,
        status: GrantStatus.SIGNED_FAUCET_MESSAGE,
      });
      const responseData: ClaimGrantResponse = {
        faucetAddress,
        nonce,
        rawAmount,
        signature,
        walletAddress: grant.walletAddress,
      };
      return response.status(200).json(responseData);
    }

    return response.status(400).json({ message: 'Invalid grant status' });
  } catch (error) {
    console.error('Error preparing redemption:', error);
    return response.status(500).json({ message: 'Failed to prepare redemption' });
  }
}
