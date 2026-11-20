import { getDb } from '@/db';
import { onboardingAnswers } from '@/db/schema';
import { OnboardingRecord, parseAnswers } from '@/lib/onboarding';
import { eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

type OnboardingRow = typeof onboardingAnswers.$inferSelect;

const readAddress = (value: unknown) => {
  if (typeof value !== 'string' || !ADDRESS_PATTERN.test(value)) {
    return null;
  }
  return value.toLowerCase();
};

const toRecord = (row: OnboardingRow): OnboardingRecord => ({
  address: row.address,
  goals: row.goals,
  profile: row.profile,
  source: row.source,
  sourceDetail: row.sourceDetail,
  submittedAt: row.submittedAt.toISOString(),
});

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
      const [row] = await db.select().from(onboardingAnswers).where(eq(onboardingAnswers.address, address)).limit(1);
      return res.status(200).json({ answers: row ? toRecord(row) : null });
    }

    const answers = parseAnswers(req.body);
    if (!answers) {
      return res.status(400).json({ error: 'Invalid answers' });
    }
    const values = { ...answers, submittedAt: new Date() };
    const [row] = await db
      .insert(onboardingAnswers)
      .values({ ...values, address })
      .onConflictDoUpdate({ set: values, target: onboardingAnswers.address })
      .returning();
    return res.status(200).json({ answers: toRecord(row) });
  } catch (error) {
    console.error('Onboarding storage failed:', error);
    return res.status(500).json({ error: 'Storage unavailable' });
  }
}
