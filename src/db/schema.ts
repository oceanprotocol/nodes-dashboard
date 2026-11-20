import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const onboardingAnswers = pgTable('onboarding_answers', {
  address: text('address').primaryKey(),
  profile: text('profile').notNull(),
  goals: text('goals').array().notNull(),
  source: text('source'),
  sourceDetail: text('source_detail'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});
