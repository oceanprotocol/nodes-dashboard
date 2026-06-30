import { Step } from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

export type InferenceStep = 'model' | 'template' | 'resources' | 'config' | 'payment';
export const getInferenceSteps = (flowType: InferenceFlowType): Step<InferenceStep>[] => [
  { key: 'model', label: 'Model', hidden: flowType === InferenceFlowType.Template },
  { key: 'template', label: 'Template', hidden: flowType !== InferenceFlowType.Template },
  { key: 'resources', label: 'Resources' },
  { key: 'config', label: 'Config', hidden: flowType === InferenceFlowType.DefaultModel },
  { key: 'payment', label: 'Payment' },
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
