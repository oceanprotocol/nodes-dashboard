import { TutorialConfig } from '../types';

// Tour for the "Compute consumer" profile (/profile/consumer) — where you track
// the compute jobs you run, what you spent, your token balances, and job
// results. Informational walkthrough: every step advances with "Next".
export const consumerProfileFlowConfig: TutorialConfig = {
  id: 'consumer-profile-flow',
  steps: [
    {
      id: 'welcome',
      page: 'consumer',
      title: 'Welcome to your compute consumer dashboard',
      description:
        'This is where you track the compute jobs you run on the Ocean Network: spending, success rate, balances, and individual job results.',
      placement: 'center',
      advance: { type: 'next' },
    },
    {
      id: 'profile-tabs',
      page: 'consumer',
      target: '[data-tutorial="profile-tabs"]',
      title: 'Consumer vs owner views',
      description:
        'Switch between "Compute consumer" (the jobs you run) and "Node owner" (the nodes you operate). You are on the Compute consumer view.',
      placement: 'bottom',
      advance: { type: 'next' },
    },
    {
      id: 'consumer-stats',
      page: 'consumer',
      target: '[data-tutorial="consumer-stats"]',
      title: 'Your spending & success rate',
      description:
        'Amount paid and jobs run per epoch, plus the share of your jobs that completed successfully. Use it to track cost and reliability over time.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'consumer-balance',
      page: 'consumer',
      target: '[data-tutorial="consumer-balance"]',
      title: 'Account balance',
      description:
        'Your token balances (COMPY, USDC, …) and transfer history. These fund your compute jobs — escrow is topped up from here.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'consumer-transfer',
      page: 'consumer',
      target: '[data-tutorial="consumer-transfer-button"]',
      title: 'Transfer tokens',
      description: '"Transfer" sends tokens to another address — handy for moving funds between wallets before paying for jobs.',
      placement: 'left',
      advance: { type: 'next' },
    },
    {
      id: 'consumer-jobs',
      page: 'consumer',
      target: '[data-tutorial="consumer-jobs"]',
      title: 'My jobs',
      description:
        'Every compute job you have run, with status and results. Open a job to download its output and logs, or check why one failed.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'done',
      page: 'consumer',
      title: "You're all set!",
      description:
        'That is your consumer dashboard. Head to "Run a job" to start a new compute job, or revisit results here any time.',
      placement: 'center',
      advance: { type: 'next' },
    },
  ],
};
