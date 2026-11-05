import { USDC } from '@/constants/tokens';
import { cappedWindows, formatSubsidyPeriod, SubsidyPayment, SubsidyProgram } from '@/lib/subsidy';

export const SUBSIDY_STATUS_ERROR = "Couldn't load your subsidy progress.";

export const SUBSIDY_STATUS_REFRESH_ERROR = "Couldn't refresh your subsidy progress. Reload the page to continue.";

export const SUBSIDY_PAYMENT_COPY: Record<SubsidyPayment, { label: string; note: string; tooltip: string }> = {
  postpaid: {
    label: 'Postpaid',
    note: 'Refunded to your escrow after the job, so the full cost needs to be in escrow when it starts.',
    tooltip: 'You pay the full cost when the job starts. The subsidy is refunded to your escrow once the job is done.',
  },
  prepaid: {
    label: 'Prepaid',
    note: 'Paid up front when the job starts, so only your part needs to be in escrow.',
    tooltip: 'The subsidy pays its part when the job starts. Only your part needs to be in escrow.',
  },
};

export const getSubsidyPaymentNote = (payments: SubsidyPayment[]) =>
  payments.length === 1
    ? SUBSIDY_PAYMENT_COPY[payments[0]].note
    : 'Part is paid up front when the job starts and part is refunded to your escrow after it.';

export const formatSubsidyAmount = (amount: number) => amount.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const formatSubsidyTokenAmount = (amount: number) => `${formatSubsidyAmount(amount)} ${USDC.symbol}`;

export const getOneTimeLabel = (program: SubsidyProgram) =>
  program.oneTime ? `${formatSubsidyTokenAmount(program.oneTime.credit)} on us` : null;

export const getDiscountLabel = (program: SubsidyProgram) =>
  program.discount ? `${formatSubsidyAmount(program.discount.percent)}% off each job` : null;

export const getDiscountLimitsLabel = (program: SubsidyProgram) => {
  const windows = program.discount ? cappedWindows(program.discount.windows) : [];
  if (windows.length === 0) {
    return null;
  }
  return `up to ${windows
    .map((window) => `${formatSubsidyTokenAmount(window.limit)} / ${formatSubsidyPeriod(window.periodSeconds)}`)
    .join(', ')}`;
};

export const getProgramSummary = (program: SubsidyProgram | null | undefined) => {
  if (!program) {
    return 'a subsidy';
  }
  return [getOneTimeLabel(program), getDiscountLabel(program)].filter(Boolean).join(' and ');
};
