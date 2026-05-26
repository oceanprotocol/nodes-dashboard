import { getOnChainUserNonce, getRpcProvider, isGrantRedeemedOnChain } from '@/api-services/faucet';
import { findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { signFaucetMessage } from '@/api-services/signer';
import { ClaimGrantResponse, GrantStatus } from '@/types/grant';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Wallet address is missing or invalid' });
  }

  try {
    const grant = await findGrantInSheet({ walletAddress });

    if (!grant) {
      return response.status(404).json({ message: 'Grant not found' });
    }

    if (grant.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Wallet address mismatch' });
    }

    if (grant.status === GrantStatus.CLAIMED) {
      return response.status(400).json({ message: 'Complimentary credits already claimed' });
    }

    const faucetAddress = process.env.GRANT_FAUCET_ADDRESS;

    if (grant.status === GrantStatus.SIGNED_FAUCET_MESSAGE) {
      if (!faucetAddress || !grant.rawAmount || !grant.nonce || !grant.signedFaucetMessage) {
        return response.status(500).json({ message: 'Failed to configure faucet' });
      }
      // Reconcile against the faucet contract before handing the user another
      // copy of the signature. If the nonce was already consumed on-chain the
      // row should be CLAIMED — re-issuing would let the user waste gas on a
      // tx the contract will reject.
      try {
        // If a txHash was persisted from a previous partial confirm, check the
        // receipt first — fastest signal that the claim already landed on-chain.
        if (grant.txHash) {
          const receipt = await getRpcProvider().getTransactionReceipt(grant.txHash);
          if (receipt?.status === 1) {
            await updateGrantInSheet({
              ...grant,
              claimDate: grant.claimDate ?? new Date(),
              nonce: undefined,
              signedFaucetMessage: undefined,
              status: GrantStatus.CLAIMED,
            });
            return response.status(400).json({ message: 'Complimentary credits already claimed' });
          }
        }
        const redeemed = await isGrantRedeemedOnChain(grant.walletAddress, grant.nonce);
        if (redeemed) {
          await updateGrantInSheet({
            ...grant,
            claimDate: grant.claimDate ?? new Date(),
            nonce: undefined,
            signedFaucetMessage: undefined,
            status: GrantStatus.CLAIMED,
          });
          return response.status(400).json({ message: 'Complimentary credits already claimed' });
        }
      } catch (error) {
        console.error('On-chain reconcile read failed in /claim:', error);
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
      const tokenAddress = process.env.NEXT_PUBLIC_GRANT_TOKEN_ADDRESS;
      // Self-heal: wallet may have claimed on-chain in a prior session whose
      // /confirm never landed, leaving the row stuck at EMAIL_VERIFIED.
      // userNonces returns 0 for wallets that have never claimed, so any
      // non-zero value means a previous claim succeeded.
      try {
        const onChainNonce = await getOnChainUserNonce(walletAddress);
        if (onChainNonce > BigInt(0)) {
          await updateGrantInSheet({
            ...grant,
            claimDate: grant.claimDate ?? new Date(),
            nonce: undefined,
            signedFaucetMessage: undefined,
            status: GrantStatus.CLAIMED,
          });
          return response.status(400).json({ message: 'Complimentary credits already claimed' });
        }
      } catch (error) {
        console.error('On-chain reconcile read failed for EMAIL_VERIFIED in /claim:', error);
      }
      const nonce = Date.now();
      if (!faucetAddress || !amount || !tokenAddress) {
        return response.status(500).json({ message: 'Failed to configure faucet' });
      }
      const { signature, amount: rawAmount } = await signFaucetMessage({
        amount,
        faucetAddress,
        nonce,
        tokenAddress,
        walletAddress: grant.walletAddress,
      });
      // Re-read row before write to detect a concurrent claim that already advanced status.
      // Prevents issuing two signatures with distinct nonces for the same wallet.
      const latest = await findGrantInSheet({ walletAddress });
      if (!latest || latest.status !== GrantStatus.EMAIL_VERIFIED) {
        if (
          latest?.status === GrantStatus.SIGNED_FAUCET_MESSAGE &&
          latest.rawAmount &&
          latest.nonce &&
          latest.signedFaucetMessage
        ) {
          const responseData: ClaimGrantResponse = {
            faucetAddress,
            nonce: latest.nonce,
            rawAmount: latest.rawAmount,
            signature: latest.signedFaucetMessage,
            walletAddress: latest.walletAddress,
          };
          return response.status(200).json(responseData);
        }
        return response.status(409).json({ message: 'Grant state changed, retry' });
      }
      const updated = await updateGrantInSheet({
        ...grant,
        amount,
        rawAmount,
        nonce,
        signedFaucetMessage: signature,
        status: GrantStatus.SIGNED_FAUCET_MESSAGE,
      });
      if (!updated) {
        return response.status(500).json({ message: 'Failed to prepare redemption' });
      }
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
