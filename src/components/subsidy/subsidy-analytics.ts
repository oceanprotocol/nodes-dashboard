import { SubsidyStep } from '@/components/stepper/get-steps';
import { getSubsidyJobTypeName, SubsidyJobType } from '@/lib/subsidy';
import { SUBSIDY_BOT_BLOCKED_ERROR } from '@/types/subsidy';
import axios from 'axios';
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

export const captureSubsidyBotBlocked = (error: unknown, endpoint: 'claim' | 'details' | 'resend_otp') => {
  if (axios.isAxiosError(error) && error.response?.data?.error === SUBSIDY_BOT_BLOCKED_ERROR) {
    posthog.capture('subsidy_bot_blocked', { endpoint });
  }
};

export const captureSubsidyCtaClick = (source: 'account' | 'payment', step: SubsidyStep, jobType?: SubsidyJobType) =>
  posthog.capture('subsidy_cta_clicked', {
    jobType: jobType ? getSubsidyJobTypeName(jobType) : undefined,
    source,
    step,
  });
