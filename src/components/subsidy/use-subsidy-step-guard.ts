import { SubsidyStep } from '@/components/stepper/get-steps';
import { useProfileContext } from '@/context/profile-context';
import { SubsidyStatus } from '@/types/subsidy';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const STEP_PATHS: Record<SubsidyStep, string> = {
  claim: '/subsidy/claim',
  details: '/subsidy/details',
  verify: '/subsidy/verify',
};

const getAllowedStep = (status: SubsidyStatus | null, step: SubsidyStep): SubsidyStep => {
  if (status === SubsidyStatus.CLAIMED) {
    return 'claim';
  }
  if (step === 'details') {
    return 'details';
  }
  if (status === SubsidyStatus.PENDING) {
    return 'verify';
  }
  if (status === SubsidyStatus.EMAIL_VERIFIED) {
    return 'claim';
  }
  return 'details';
};

/**
 * Sends the user to the step their saved progress allows, so the flow can be left and resumed
 * from any device. Returns whether the requested step can render.
 */
const useSubsidyStepGuard = (step: SubsidyStep): boolean => {
  const router = useRouter();
  const { subsidyInfo } = useProfileContext();

  const allowedStep = subsidyInfo ? getAllowedStep(subsidyInfo.status, step) : null;

  useEffect(() => {
    if (allowedStep && allowedStep !== step) {
      router.replace(STEP_PATHS[allowedStep]);
    }
  }, [allowedStep, router, step]);

  return allowedStep === step;
};

export default useSubsidyStepGuard;
