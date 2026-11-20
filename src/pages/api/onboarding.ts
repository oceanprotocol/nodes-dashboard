import { getDb } from '@/db';
import { onboardingAnswers } from '@/db/schema';
import { getOnboardingDestination, OnboardingStatus, parseAnswers } from '@/lib/onboarding';
import { eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const readAddress = (value: unknown) => {
  if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value)) {
    return null;
  }
  return value.toLowerCase();
};

const toStatus = (goals: string[] | null): OnboardingStatus =>
  goals ? { destination: getOnboardingDestination(goals), onboarded: true } : { destination: null, onboarded: false };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const address = readAddress(req.method === 'GET' ? req.query.address : req.body?.address);
  if (!address) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  try {
    const db = getDb();

    if (req.method === 'GET') {
      const [row] = await db
        .select({ goals: onboardingAnswers.goals })
        .from(onboardingAnswers)
        .where(eq(onboardingAnswers.address, address))
        .limit(1);
      return res.status(200).json(toStatus(row?.goals ?? null));
    }

    const answers = parseAnswers(req.body);
    if (!answers) {
      return res.status(400).json({ error: 'Invalid answers' });
    }
    const values = { ...answers, submittedAt: new Date() };
    await db
      .insert(onboardingAnswers)
      .values({ ...values, address })
      .onConflictDoUpdate({ set: values, target: onboardingAnswers.address });
    return res.status(200).json(toStatus(answers.goals));
  } catch (error) {
    console.error('Onboarding storage failed:', error);
    return res.status(500).json({ error: 'Storage unavailable' });
  }
}
