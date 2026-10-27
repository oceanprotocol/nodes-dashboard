import { USDC } from '@/constants/tokens';
import { cappedWindows, formatSubsidyPeriod, SubsidyProgram } from '@/lib/subsidy';

export const SUBSIDY_STATUS_ERROR = "Couldn't load your subsidy progress.";

export const SUBSIDY_STATUS_REFRESH_ERROR = "Couldn't refresh your subsidy progress. Reload the page to continue.";

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
