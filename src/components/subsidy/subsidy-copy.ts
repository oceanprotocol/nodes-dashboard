import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { formatSubsidyPeriod, SubsidyProgram, SubsidyWindow } from '@/lib/subsidy';

export const formatSubsidyAmount = (amount: number) => amount.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const formatSubsidyTokenAmount = (amount: number) => `${formatSubsidyAmount(amount)} ${SUBSIDY_TOKEN_SYMBOL}`;

const cappedWindows = (windows: SubsidyWindow[]) => windows.filter((window) => !window.unlimited);

/** "10 USDC on us" */
export const getOneTimeLabel = (program: SubsidyProgram) =>
  program.oneTime ? `${formatSubsidyTokenAmount(program.oneTime.credit)} on us` : null;

/** "100% off each job" */
export const getDiscountLabel = (program: SubsidyProgram) =>
  program.discount ? `${formatSubsidyAmount(program.discount.percent)}% off each job` : null;

/** "up to 5 USDC / day, 10 USDC / week" */
export const getDiscountLimitsLabel = (program: SubsidyProgram) => {
  const windows = program.discount ? cappedWindows(program.discount.windows) : [];
  if (windows.length === 0) {
    return null;
  }
  return `up to ${windows
    .map((window) => `${formatSubsidyTokenAmount(window.limit)} / ${formatSubsidyPeriod(window.periodSeconds)}`)
    .join(', ')}`;
};

/** "10 USDC on us and 100% off each job", or a generic phrase when no program is known. */
export const getProgramSummary = (program: SubsidyProgram | null | undefined) => {
  if (!program) {
    return 'a subsidy';
  }
  return [getOneTimeLabel(program), getDiscountLabel(program)].filter(Boolean).join(' and ');
};
