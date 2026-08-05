import { getInferenceSteps, InferenceStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

type InferenceStepperProps = {
  currentStep: InferenceStep;
  flowType: InferenceFlowType;
  /** Edit re-entry: hides the (skipped) Resources step. */
  edit?: boolean;
  /** Fresh template launch that needs the Config step — see templateNeedsBucketPicker. */
  showTemplateConfig?: boolean;
};

const InferenceStepper: React.FC<InferenceStepperProps> = ({ currentStep, flowType, edit, showTemplateConfig }) => {
  return <Stepper currentStep={currentStep} steps={getInferenceSteps(flowType, edit, showTemplateConfig)} />;
};

export default InferenceStepper;
