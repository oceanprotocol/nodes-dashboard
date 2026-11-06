import { ethers } from 'ethers';
import type { NextApiRequest, NextApiResponse } from 'next';
import * as Yup from 'yup';

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

/** Rejects wrong types and unknown keys. Responds 400 and returns `null` on failure. */
export const parseBody = async <T extends Yup.AnyObject>(
  request: NextApiRequest,
  response: NextApiResponse,
  schema: Yup.ObjectSchema<T>
): Promise<T | null> => {
  try {
    return await schema.noUnknown().required().validate(request.body, { strict: true });
  } catch {
    response.status(400).json({ message: 'Invalid request' });
    return null;
  }
};
