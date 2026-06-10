import { TutorialConfig } from '../types';

// Tour for the "Node owner" profile (/profile/owner) — the admin center where
// you monitor your nodes' revenue, jobs and eligibility, and jump to running a
// new node. Informational walkthrough: every step advances with "Next" so the
// user is never blocked and stays on the page.
export const ownerProfileFlowConfig: TutorialConfig = {
  id: 'owner-profile-flow',
  steps: [
    {
      id: 'welcome',
      page: 'owner',
      title: 'Welcome to your node owner dashboard',
      description:
        'This is your admin center. From here you track how your nodes are performing, their rewards, and their eligibility — and you can spin up new ones.',
      placement: 'center',
      advance: { type: 'next' },
    },
    {
      id: 'profile-tabs',
      page: 'owner',
      target: '[data-tutorial="profile-tabs"]',
      title: 'Owner vs consumer views',
      description:
        'Switch between "Node owner" (the nodes you operate) and "Compute consumer" (the jobs you run). You are on the Node owner view.',
      placement: 'bottom',
      advance: { type: 'next' },
    },
    {
      id: 'owner-stats',
      page: 'owner',
      target: '[data-tutorial="owner-stats"]',
      title: 'Your performance',
      description:
        'Revenue and jobs per epoch across your nodes, plus the share of your nodes that are currently eligible for incentives. Aim to keep eligibility high.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'owner-nodes',
      page: 'owner',
      target: '[data-tutorial="owner-nodes"]',
      title: 'My nodes',
      description:
        'Every node you operate, with status, eligibility and rewards. Click a row to open a node\'s detail page and monitor it closely.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'owner-run-node',
      page: 'owner',
      target: '[data-tutorial="owner-run-node-button"]',
      title: 'Run another node',
      description:
        '"Run a node" opens the guided node setup — start the Docker node, connect it, and tune its config. More eligible nodes means more rewards.',
      placement: 'left',
      advance: { type: 'next' },
    },
    {
      id: 'done',
      page: 'owner',
      title: "You're all set!",
      description:
        'That is your owner admin center. Keep an eye on eligibility and rewards, and add nodes to grow your footprint on the Ocean Network.',
      placement: 'center',
      advance: { type: 'next' },
    },
  ],
};
