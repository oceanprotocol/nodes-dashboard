import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method not allowed' });
  }

  const { urlForSignature } = request.body as { urlForSignature?: string };

  if (!urlForSignature) {
    return response.status(400).json({ message: 'Missing URL for signature' });
  }

  const secretKey = process.env.MOONPAY_SECRET_KEY;

  if (!secretKey) {
    return response.status(500).json({ message: 'On-ramp is not configured properly' });
  }

  try {
    // MoonPay signing: HMAC-SHA256 over the query string portion of the URL,
    // base64-encoded, then URL-encoded.
    const signature = crypto.createHmac('sha256', secretKey).update(new URL(urlForSignature).search).digest('base64');

    return response.status(200).json({ signature });
  } catch (error) {
    console.error('Error signing MoonPay URL', error);
    return response.status(500).json({ message: 'Failed to sign URL' });
  }
}
