import { OnboardingRecord, parseAnswers } from '@/lib/onboarding';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock store: answers live in server memory only and are lost on restart or across serverless instances.
const globalStore = globalThis as typeof globalThis & { onboardingAnswers?: Map<string, OnboardingRecord> };
const store = (globalStore.onboardingAnswers ??= new Map<string, OnboardingRecord>());

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const readAddress = (value: unknown) => {
  if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value)) {
    return null;
  }
  return value.toLowerCase();
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const address = readAddress(req.query.address);
    if (!address) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    return res.status(200).json({ answers: store.get(address) ?? null });
  }

  if (req.method === 'POST') {
    const address = readAddress(req.body?.address);
    if (!address) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const answers = parseAnswers(req.body);
    if (!answers) {
      return res.status(400).json({ error: 'Invalid answers' });
    }
    const record: OnboardingRecord = { ...answers, address, submittedAt: new Date().toISOString() };
    store.set(address, record);
    return res.status(200).json({ answers: record });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
