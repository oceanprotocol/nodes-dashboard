import { getInferenceSteps, InferenceStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

type InferenceStepperProps = {
  currentStep: InferenceStep;
  flowType: InferenceFlowType;
  /** Edit re-entry: hides the (skipped) Resources step. */
  edit?: boolean;
};

const InferenceStepper: React.FC<InferenceStepperProps> = ({ currentStep, flowType, edit }) => {
  return <Stepper currentStep={currentStep} steps={getInferenceSteps(flowType, edit)} />;
};

export default InferenceStepper;
