import { SubsidyStep } from '@/components/stepper/get-steps';
import { getSubsidyJobTypeName, SubsidyJobType } from '@/lib/subsidy';
import posthog from 'posthog-js';

export type SubsidyPaymentState =
  | 'applied'
  | 'capped'
  | 'custom_applied'
  | 'limit_reached'
  | 'load_error'
  | 'node_not_subsidized'
  | 'not_on_list'
  | 'not_signed_up'
  | 'paused'
  | 'signup_incomplete';

export const captureSubsidyCtaClick = (source: 'account' | 'payment', step: SubsidyStep, jobType?: SubsidyJobType) =>
  posthog.capture('subsidy_cta_clicked', {
    jobType: jobType ? getSubsidyJobTypeName(jobType) : undefined,
    source,
    step,
  });
