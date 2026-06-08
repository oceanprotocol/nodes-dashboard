import { TutorialConfig } from '../types';

export const runJobFlowConfig: TutorialConfig = {
  id: 'run-job-flow',
  steps: [
    {
      id: 'welcome',
      page: 'environments',
      title: "Welcome! Let's run your first job",
      description:
        "This guided tour walks you through running a free test compute job on the Ocean Network. You'll perform each step yourself — I'll explain along the way.",
      placement: 'center',
      advance: { type: 'next' },
    },
    {
      id: 'connect-wallet',
      page: 'environments',
      target: '[data-tutorial="login-button"]',
      title: 'Connect your wallet',
      description:
        'You need to be logged in to run a job. Click "Log in" and connect your wallet — the tour continues once you are connected.',
      placement: 'bottom',
      advance: { type: 'auth' },
    },
    {
      id: 'stepper',
      page: 'environments',
      target: '[data-tutorial="stepper"]',
      title: 'Job flow overview',
      description:
        'The stepper tracks progress: Environment → Resources → Finish. Free test jobs skip the payment step.',
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
        'Toggle the "Test compute" switch on. This filters the list to environments that offer free test compute — no tokens or payment needed.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'find-environments',
      page: 'environments',
      target: '[data-tutorial="find-environments-button"]',
      title: 'Find environments',
      description: 'Click "Find environments" to apply the filter and list matching free test environments.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'run-test-job',
      page: 'environments',
      target: '[data-tutorial="run-test-job-button"]',
      title: 'Run a test job',
      description:
        'With the test compute filter on, each card shows a "Run test job" button. Click it on your preferred environment to continue to resources. (If it is disabled, your wallet is not on that environment\'s test access list — try another card.)',
      placement: 'top',
      advance: { type: 'navigate' },
      requireEnabled: true,
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
      title: 'Select GPUs (optional)',
      description:
        'Open the GPU dropdown to pick GPUs if this environment offers any. "Select all" picks every available GPU at once. GPUs are optional — leave it empty for a CPU-only job.',
      placement: 'top',
      advance: { type: 'next' },
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
        'Click "Continue". Because this is free test compute, you skip payment and go straight to the summary.',
      placement: 'top',
      advance: { type: 'navigate' },
      requireEnabled: true,
    },
    {
      id: 'summary-review',
      page: 'summary',
      target: '[data-tutorial="summary-review"]',
      title: 'Review your setup',
      description:
        'Review the environment, resources, and cost (Free for test compute). Last chance to go back and adjust before generating an auth token.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'generate-token',
      page: 'summary',
      target: '[data-tutorial="generate-token-button"]',
      title: 'Generate auth token',
      description:
        'Set an optional expiration, then click "Generate auth token". This token authorizes the Ocean Orchestrator to connect to the node and run your job on your behalf.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'open-ide',
      page: 'summary',
      target: '[data-tutorial="open-ide-button"]',
      title: 'Launch in your IDE',
      description:
        'Pick your editor with "Choose editor", then click "Open" to launch the job via Ocean Orchestrator directly in VS Code, Cursor, Antigravity, or Windsurf.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'done',
      page: 'summary',
      title: "You're all set!",
      description:
        'That is the full flow for running a free test job on Ocean Network. Open your IDE and start computing, or explore the dashboard. Happy computing!',
      placement: 'center',
      advance: { type: 'next' },
    },
  ],
};
