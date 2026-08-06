import { getInferenceSteps, InferenceStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';
import { AppTemplate, isBundle, requiredEnvVars } from '@/types/templates';

type InferenceStepperProps = {
  currentStep: InferenceStep;
  flowType: InferenceFlowType;
  /** Edit re-entry: hides the (skipped) Resources step. */
  edit?: boolean;
  /**
   * The picked template, for the Template flow. It decides the first step's label (Service vs Template)
   * and whether a fresh launch gets a Config step at all — pass it wherever it is known, so the step
   * list matches the route the user is actually walking.
   */
  template?: AppTemplate | null;
  /** Catalogue pages know which kind they list before anything is picked — they pass it directly. */
  kindLabel?: 'Service' | 'Template';
  /** Fresh template launch that needs the Config step — see templateNeedsBucketPicker. */
  showTemplateConfig?: boolean;
};

const InferenceStepper: React.FC<InferenceStepperProps> = ({
  currentStep,
  flowType,
  edit,
  template,
  kindLabel,
  showTemplateConfig,
}) => {
  const steps = getInferenceSteps(flowType, edit, {
    kindLabel: kindLabel ?? (template && isBundle(template) ? 'Template' : 'Service'),
    // Either reason forces the Config step on a fresh launch: a required env var to collect, or a
    // bucket to pick. Both are collected on that page, so they share one flag.
    needsConfig: (!!template && requiredEnvVars(template).length > 0) || !!showTemplateConfig,
  });
  return <Stepper currentStep={currentStep} steps={steps} />;
};

export default InferenceStepper;
