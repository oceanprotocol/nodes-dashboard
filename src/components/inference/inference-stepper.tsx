import { getInferenceSteps, InferenceStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { InferenceFlowType } from '@/types/inference';

type InferenceStepperProps = {
  currentStep: InferenceStep;
  flowType: InferenceFlowType;
};

const InferenceStepper: React.FC<InferenceStepperProps> = ({ currentStep, flowType }) => {
  return <Stepper currentStep={currentStep} steps={getInferenceSteps(flowType)} />;
};

export default InferenceStepper;
