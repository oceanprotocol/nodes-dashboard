import { getInferenceSteps, InferenceStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';
import { templateNeedsConfigStep } from '@/services/template-launch';
import { AppTemplate, isBundle } from '@/types/templates';

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
  /**
   * Force the Config step on when the template alone can't say so — the config page itself, which is
   * on that step by definition. Otherwise leave it unset: the step list is derived from `template`
   * via templateNeedsConfigStep, the same predicate the routing uses.
   */
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
    // One predicate with the routing, so the drawn steps can't disagree with the walked ones.
    needsConfig: templateNeedsConfigStep(template) || !!showTemplateConfig,
  });
  return <Stepper currentStep={currentStep} steps={steps} />;
};

export default InferenceStepper;
