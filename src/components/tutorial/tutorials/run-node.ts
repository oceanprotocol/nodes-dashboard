import { TutorialConfig } from '../types';

export const runNodeFlowConfig: TutorialConfig = {
  id: 'run-node-flow',
  steps: [
    {
      id: 'welcome',
      page: 'setup',
      title: "Welcome! Let's run an Ocean Node",
      description:
        'This guided tour walks you through hosting your own Ocean Node and connecting it to the dashboard. You will perform each step yourself — I will explain along the way.',
      placement: 'center',
      advance: { type: 'next' },
    },
    {
      id: 'stepper',
      page: 'setup',
      target: '[data-tutorial="stepper"]',
      title: 'Node flow overview',
      description: 'The stepper tracks progress: Setup → Configure. First you start the node, then you tune its config.',
      placement: 'bottom',
      advance: { type: 'next' },
    },
    {
      id: 'install-commands',
      page: 'setup',
      target: '[data-tutorial="install-commands"]',
      title: 'Start your node with Docker',
      description:
        'Run these commands on your host machine: the quick start script, then "docker-compose up -d", then "docker ps" to confirm the containers are running. Docker Engine + Compose make the node eligible for incentives.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'connect-wallet',
      page: 'setup',
      target: '[data-tutorial="login-button"]',
      title: 'Connect your wallet',
      description:
        'You need to be logged in to connect and configure your node. Click "Log in" and connect your wallet — the tour continues once you are connected.',
      placement: 'bottom',
      advance: { type: 'auth' },
    },
    {
      id: 'connection-card',
      page: 'setup',
      target: '[data-tutorial="node-connection"]',
      title: 'Connect to your node',
      description:
        'This card links the dashboard to your running node. Once connected you can view its details and push configuration to it.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'node-id',
      page: 'setup',
      target: '[data-tutorial="node-id-input"]',
      title: 'Enter your node ID',
      description:
        'Paste your node\'s ID. To find it, query your running node: curl http://<node-host>:<http-port>.',
      placement: 'top',
      advance: { type: 'change' },
    },
    {
      id: 'connect-node',
      page: 'setup',
      target: '[data-tutorial="connect-node-button"]',
      title: 'Connect',
      description: 'Click "Connect" to link the dashboard to your node. This may take a moment while peer-to-peer connects.',
      placement: 'top',
      advance: { type: 'click' },
    },
    {
      id: 'edit-config',
      page: 'setup',
      target: '[data-tutorial="edit-config-button"]',
      title: 'Edit node config',
      description: 'Now that you are connected, click "Edit node config" to review and tune your node settings.',
      placement: 'top',
      advance: { type: 'navigate' },
      requireEnabled: true,
    },
    {
      id: 'config-editor',
      page: 'configure',
      target: '[data-tutorial="config-editor"]',
      title: 'Edit configuration',
      description:
        'This is your node\'s live config as JSON. Expand sections and edit values directly — for example to adjust compute environments or resources.',
      placement: 'right',
      advance: { type: 'next' },
    },
    {
      id: 'config-preview',
      page: 'configure',
      target: '[data-tutorial="config-preview"]',
      title: 'Preview compute resources',
      description:
        'A live preview of the compute environments your config exposes: GPUs, CPU, RAM, disk and their pricing. Use it to sanity-check your edits.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'push-config',
      page: 'configure',
      target: '[data-tutorial="push-config-button"]',
      title: 'Push config to node',
      description:
        'Click "Push config to node" to apply your changes to the running node. Format errors are shown below the editor if anything is invalid.',
      placement: 'top',
      advance: { type: 'next' },
    },
    {
      id: 'done',
      page: 'configure',
      title: "You're all set!",
      description:
        'Your node is running and configured. Open its details page to monitor status, jobs and rewards. Thanks for helping power the Ocean Network!',
      placement: 'center',
      advance: { type: 'next' },
    },
  ],
};
