import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';

export const isWalletAddress = (value: unknown): value is string =>
  typeof value === 'string' && ethers.isAddress(value);

/** Responds 405 and returns `false` for any other method. */
export const allowMethod = (request: NextApiRequest, response: NextApiResponse, method: 'GET' | 'POST') => {
  if (request.method === method) {
    return true;
  }
  response.status(405).json({ message: 'Method not allowed' });
  return false;
};
