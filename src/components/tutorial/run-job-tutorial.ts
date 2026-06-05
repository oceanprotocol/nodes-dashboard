export type TutorialId = 'run-job-flow';

export type TutorialPage = 'environments' | 'resources' | 'payment' | 'summary';

export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type AdvanceTrigger =
  | { type: 'next' }
  | { type: 'click' }
  | { type: 'change'; pollMs?: number }
  | { type: 'navigate' };

export type TutorialStep = {
  id: string;
  page: TutorialPage;
  target?: string;
  title: string;
  description: string;
  placement?: StepPlacement;
  advance: AdvanceTrigger;
  requireEnabled?: boolean;
};

export type TutorialConfig = {
  id: TutorialId;
  steps: TutorialStep[];
};

const runJobFlowConfig: TutorialConfig = {
  id: 'run-job-flow',
  steps: [
    {
      id: 'welcome',
      page: 'environments',
      title: "Welcome! Let's run your first job",
      description:
        "This guided tour walks you through running a compute job on the Ocean Network. You'll perform each step yourself — I'll explain along the way.",
      placement: 'center',
      advance: { type: 'next' },
    },
    {
      id: 'stepper',
      page: 'environments',
      target: '[data-tutorial="stepper"]',
      title: 'Job flow overview',
      description: 'The stepper tracks progress: Environment → Resources → Payment → Finish.',
      placement: 'bottom',
      advance: { type: 'next' },
    },
    {
      id: 'environment-list',
      page: 'environments',
      target: '[data-tutorial="environment-list"]',
      title: 'Browse environments',
      description:
        'Each card shows a compute environment: GPUs, CPU, RAM, disk, pricing. Have a look at what is available.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'test-compute-filter',
      page: 'environments',
      target: '[data-tutorial="test-compute-filter"]',
      title: 'Filter for test compute',
      description:
        'Toggle the "Test compute" filter to show only environments that offer free test compute.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'find-environments',
      page: 'environments',
      target: '[data-tutorial="find-environments-button"]',
      title: 'Find environments',
      description: 'Click "Find environments" to apply your filters and list matching environments.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'test-compute',
      page: 'environments',
      target: '[data-tutorial="test-compute-checkbox"]',
      title: 'Enable test compute',
      description:
        'Check "Test compute" on any environment card. This unlocks free test compute and enables the "Run test job" button.',
      placement: 'top',
      advance: { type: 'change' },
    },
    {
      id: 'run-test-job',
      page: 'environments',
      target: '[data-tutorial="run-test-job-button"]',
      title: 'Run a test job',
      description: 'The "Run test job" button is now enabled. Click it to continue.',
      placement: 'top',
      advance: { type: 'navigate' },
      requireEnabled: true,
    },
    {
      id: 'environment-select',
      page: 'environments',
      target: '[data-tutorial="environment-select-button"]',
      title: 'Select an environment',
      description: 'Click "Select" on your preferred environment to continue to resources.',
      placement: 'top',
      advance: { type: 'navigate' },
    },
    {
      id: 'resources-overview',
      page: 'resources',
      target: '[data-tutorial="resources-selector"]',
      title: 'Configure resources',
      description: 'Pick the resources your job needs: GPUs, CPU cores, RAM, disk, and duration.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'gpu-select',
      page: 'resources',
      target: '[data-tutorial="gpu-select"]',
      title: 'Select GPUs',
      description:
        'Open the GPU dropdown and pick at least one GPU. "Select all" picks every available GPU at once.',
      placement: 'top',
      advance: { type: 'change' },
    },
    {
      id: 'duration',
      page: 'resources',
      target: '[data-tutorial="duration-slider"]',
      title: 'Set job duration',
      description: 'Adjust the max job duration. Use the unit selector to switch between minutes, hours, etc.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'continue-resources',
      page: 'resources',
      target: '[data-tutorial="continue-button"]',
      title: 'Continue',
      description:
        'Click "Continue". Paid environments go to payment; free compute jumps straight to the summary.',
      placement: 'top',
      advance: { type: 'navigate' },
      requireEnabled: true,
    },
    {
      id: 'payment-overview',
      page: 'payment',
      target: '[data-tutorial="payment-section"]',
      title: 'Payment & authorization',
      description:
        'Review the estimated cost and authorize the transaction. Tokens lock in escrow; unused amounts return after the job completes.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'authorize',
      page: 'payment',
      target: '[data-tutorial="authorize-button"]',
      title: 'Authorize payment',
      description: 'Click "Authorize" to lock tokens for this job. You will move to the summary automatically.',
      placement: 'top',
      advance: { type: 'navigate' },
    },
    {
      id: 'summary-review',
      page: 'summary',
      target: '[data-tutorial="summary-review"]',
      title: 'Review your setup',
      description:
        'Review environment, resources, and cost. Last chance to go back and adjust anything before generating an auth token.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'generate-token',
      page: 'summary',
      target: '[data-tutorial="generate-token-button"]',
      title: 'Generate auth token',
      description:
        'Click "Generate Token" to create an auth token. Use it from your IDE (VS Code, Cursor, etc.) to run the job on the remote environment.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'done',
      page: 'summary',
      title: "You're all set!",
      description:
        'That is the full flow for running a job on Ocean Network. Open your IDE and start computing, or explore the dashboard. Happy computing!',
      placement: 'center',
      advance: { type: 'next' },
    },
  ],
};

export const getTutorialConfig = (id: TutorialId): TutorialConfig => {
  switch (id) {
    case 'run-job-flow':
      return runJobFlowConfig;
    default:
      return { id, steps: [] };
  }
};
