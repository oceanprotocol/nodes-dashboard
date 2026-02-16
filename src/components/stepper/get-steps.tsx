import { Step } from '@/components/stepper/stepper';

export type GrantStep = 'details' | 'verify' | 'claim';
export const getGrantSteps = (): Step<GrantStep>[] => [
  { key: 'details', label: 'Details' },
  { key: 'verify', label: 'Verify' },
  { key: 'claim', label: 'Claim' },
];

export type RunJobStep = 'environment' | 'resources' | 'payment' | 'finish';
export const getRunJobSteps = (freeCompute: boolean): Step<RunJobStep>[] => [
  { key: 'environment', label: 'Environment' },
  { key: 'resources', label: 'Resources' },
  { key: 'payment', label: 'Payment', hidden: freeCompute },
  { key: 'finish', label: 'Finish' },
];

export type RunNodeStep = 'setup' | 'configure';
export const getRunNodeSteps = (): Step<RunNodeStep>[] => [
  { key: 'setup', label: 'Set up' },
  { key: 'configure', label: 'Configure' },
];
