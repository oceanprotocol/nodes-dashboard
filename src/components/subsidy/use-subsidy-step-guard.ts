import { GrantStep } from '@/components/stepper/get-steps';
import { useProfileContext } from '@/context/profile-context';
import { GrantStatus } from '@/types/grant';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const STEP_PATHS: Record<GrantStep, string> = {
  claim: '/grant/claim',
  details: '/grant/details',
  verify: '/grant/verify',
};

const getAllowedStep = (status: GrantStatus | null, step: GrantStep): GrantStep => {
  if (status === GrantStatus.CLAIMED) {
    return 'claim';
  }
  if (step === 'details') {
    return 'details';
  }
  if (status === GrantStatus.PENDING) {
    return 'verify';
  }
  if (status === GrantStatus.EMAIL_VERIFIED) {
    return 'claim';
  }
  return 'details';
};

/**
 * Sends the user to the step their saved progress allows, so the flow can be left and resumed
 * from any device. Returns whether the requested step can render.
 */
const useGrantStepGuard = (step: GrantStep): boolean => {
  const router = useRouter();
  const { grantInfo } = useProfileContext();

  const allowedStep = grantInfo ? getAllowedStep(grantInfo.status, step) : null;

  useEffect(() => {
    if (allowedStep && allowedStep !== step) {
      router.replace(STEP_PATHS[allowedStep]);
    }
  }, [allowedStep, router, step]);

  return allowedStep === step;
};

export default useGrantStepGuard;
