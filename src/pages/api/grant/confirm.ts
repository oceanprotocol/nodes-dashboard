import { getRpcProvider, isGrantRedeemedOnChain } from '@/api-services/faucet';
import { findGrantByTxHash, findGrantInSheet, updateGrantInSheet } from '@/api-services/gsheets';
import { GrantStatus, GrantWithStatus } from '@/types/grant';
import { waitUntil } from '@vercel/functions';
import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

// Reserve enough wall time on Vercel for the background reconcile path. Pro
// plan caps per-invocation duration; we explicitly raise it so `waitUntil`
// has room to finish.
export const config = { maxDuration: 300 };

const BG_RECEIPT_WAIT_MS = 4 * 60 * 1000;
const BG_NONCE_POLL_MS = 5_000;
const BG_NONCE_POLL_ATTEMPTS = 6;

async function markClaimed(grant: GrantWithStatus, txHash: string) {
  await updateGrantInSheet({
    ...grant,
    claimDate: grant.claimDate ?? new Date(),
    nonce: undefined,
    signedFaucetMessage: undefined,
    status: GrantStatus.CLAIMED,
    txHash,
  });
}

async function reconcileAndMarkClaimed(walletAddress: string, txHash: string) {
  const latest = await findGrantInSheet({ walletAddress });
  if (!latest || latest.status === GrantStatus.CLAIMED) return;
  await markClaimed(latest, txHash);
}

/**
 * Runs after the HTTP response has been sent (via waitUntil). Waits for the
 * receipt with a long timeout; if that times out, falls back to polling the
 * faucet's on-chain nonce so we can still finalize the grant row.
 */
async function backgroundReconcile(walletAddress: string, txHash: string) {
  try {
    const provider = getRpcProvider();

    let receipt: ethers.TransactionReceipt | null = null;
    try {
      receipt = await provider.waitForTransaction(txHash, 1, BG_RECEIPT_WAIT_MS);
    } catch {
      receipt = null;
    }

    const latest = await findGrantInSheet({ walletAddress });
    if (!latest || latest.status === GrantStatus.CLAIMED) return;

    if (receipt) {
      if (receipt.status === 1 && latest.nonce !== undefined) {
        if (await isGrantRedeemedOnChain(walletAddress, latest.nonce)) {
          await markClaimed(latest, txHash);
        }
      }
      return;
    }

    if (latest.nonce === undefined) return;
    for (let attempt = 0; attempt < BG_NONCE_POLL_ATTEMPTS; attempt++) {
      try {
        if (await isGrantRedeemedOnChain(walletAddress, latest.nonce)) {
          await reconcileAndMarkClaimed(walletAddress, txHash);
          return;
        }
      } catch (error) {
        console.error('Background nonce poll error:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, BG_NONCE_POLL_MS));
    }
  } catch (error) {
    console.error('Background reconcile crashed:', error);
  }
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, txHash } = request.body;

  if (!walletAddress || typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
    return response.status(400).json({ message: 'Invalid wallet address' });
  }

  if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return response.status(400).json({ message: 'Invalid transaction hash' });
  }

  try {
    const provider = getRpcProvider();

    const faucetAddress = process.env.GRANT_FAUCET_ADDRESS?.toLowerCase();
    if (!faucetAddress) {
      return response.status(500).json({ message: 'Faucet not configured' });
    }

    // Fan out the three independent reads so we don't pay 3× RPC/sheet latency
    // back-to-back. Each promise is independent; failures are handled below.
    const [grant, tx, fastReceipt] = await Promise.all([
      findGrantInSheet({ walletAddress }),
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!grant) {
      return response.status(404).json({ message: 'Grant not found' });
    }

    if (grant.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Wallet address mismatch' });
    }

    if (grant.status === GrantStatus.CLAIMED) {
      return response.status(200).json({ message: 'Already marked as claimed' });
    }

    if (grant.status !== GrantStatus.SIGNED_FAUCET_MESSAGE) {
      return response.status(400).json({ message: 'Grant is not in a claimable state' });
    }

    if (!tx) {
      return response.status(400).json({ message: 'Transaction not found' });
    }

    const existingByTx = await findGrantByTxHash(txHash);
    if (existingByTx && existingByTx.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return response.status(403).json({ message: 'Transaction already used by another grant' });
    }

    // Fast path — receipt already available. Re-read the row before write to
    // avoid clobbering a concurrent reconcile that already finalized it.
    if (fastReceipt) {
      if (fastReceipt.status !== 1) {
        return response.status(400).json({ message: 'Transaction failed on-chain' });
      }
      if (grant.nonce === undefined) {
        return response.status(500).json({ message: 'Grant nonce missing' });
      }
      const redeemed = await isGrantRedeemedOnChain(walletAddress, grant.nonce);
      if (!redeemed) {
        return response.status(400).json({ message: 'Transaction did not redeem this grant' });
      }
      await reconcileAndMarkClaimed(walletAddress, txHash);
      return response.status(200).json({ status: GrantStatus.CLAIMED });
    }

    // Slow path — persist txHash so /status and any reconcile sweep can find
    // the row, then hand off the wait to a detached background task. If the
    // persist fails we refuse to schedule the background work and surface 500,
    // since the row would otherwise be unrecoverable without the txHash.
    if (grant.txHash !== txHash) {
      try {
        const persisted = await updateGrantInSheet({ ...grant, txHash });
        if (!persisted) {
          console.error('Grant row not found when persisting txHash before background reconcile');
          return response.status(500).json({ message: 'Failed to confirm claim' });
        }
      } catch (error) {
        console.error('Failed to persist txHash before background reconcile:', error);
        return response.status(500).json({ message: 'Failed to confirm claim' });
      }
    }

    waitUntil(backgroundReconcile(walletAddress, txHash));

    return response
      .status(202)
      .json({ status: GrantStatus.SIGNED_FAUCET_MESSAGE, message: 'Confirmation in progress' });
  } catch (error) {
    console.error('Error confirming claim:', error);
    return response.status(500).json({ message: 'Failed to confirm claim' });
  }
}
