import { Step } from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

export type InferenceStep = 'model' | 'template' | 'resources' | 'config' | 'payment';
// `edit` re-entry keeps the same environment, so the resources step is skipped entirely.
// The quick-start (DefaultModel) flow picks a whole package — model + hardware + engine preset —
// so its env auto-matches on the package step and both Resources and Config are skipped.
export const getInferenceSteps = (flowType: InferenceFlowType, edit = false): Step<InferenceStep>[] => [
  {
    key: 'model',
    label: flowType === InferenceFlowType.DefaultModel ? 'Package' : 'Model',
    hidden: flowType === InferenceFlowType.Template,
  },
  { key: 'template', label: 'Template', hidden: flowType !== InferenceFlowType.Template },
  { key: 'resources', label: 'Resources', hidden: edit || flowType === InferenceFlowType.DefaultModel },
  { key: 'config', label: 'Config', hidden: flowType === InferenceFlowType.DefaultModel },
  { key: 'payment', label: edit ? 'Relaunch' : 'Payment' },
];

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
