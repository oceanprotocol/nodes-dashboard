import { Step } from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

export type InferenceStep = 'model' | 'template' | 'resources' | 'config' | 'payment';

/** Extra shape of the Template flow, which covers both catalogues: Services and Templates. */
export type TemplateStepOptions = {
  /** Which catalogue the pick came from, for the first step's label. */
  kindLabel?: 'Service' | 'Template';
  /**
   * The template declares a `required` env var, so a fresh launch must collect it before payment —
   * without it the container starts and fails (a gated model 404s, an API key is missing). Templates
   * whose vars are all optional keep skipping the step, which is the friction they exist to remove.
   */
  needsConfig?: boolean;
};

// `edit` re-entry keeps the same environment, so the resources step is skipped entirely.
// The quick-start (DefaultModel) flow picks a whole package — model + hardware + engine preset —
// so its env auto-matches on the package step and both Resources and Config are skipped.
export const getInferenceSteps = (
  flowType: InferenceFlowType,
  edit = false,
  template: TemplateStepOptions = {}
): Step<InferenceStep>[] => [
  {
    key: 'model',
    label: flowType === InferenceFlowType.DefaultModel ? 'Package' : 'Model',
    hidden: flowType === InferenceFlowType.Template,
  },
  {
    key: 'template',
    label: template.kindLabel ?? 'Service',
    hidden: flowType !== InferenceFlowType.Template,
  },
  { key: 'resources', label: 'Resources', hidden: edit || flowType === InferenceFlowType.DefaultModel },
  {
    key: 'config',
    label: 'Config',
    // Templates skip config on a fresh launch unless the template declares a required var, but always
    // show it when editing a running service — reconfiguring the env vars is the point of a template edit.
    hidden:
      flowType === InferenceFlowType.DefaultModel ||
      (flowType === InferenceFlowType.Template && !edit && !template.needsConfig),
  },
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
