import Button from '@/components/button/button';
import { captureSubsidyCtaClick, SubsidyPaymentState } from '@/components/subsidy/subsidy-analytics';
import { formatSubsidyAmount, getDiscountLimitsLabel, getProgramSummary } from '@/components/subsidy/subsidy-copy';
import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { useProfileContext } from '@/context/profile-context';
import {
  formatSubsidyPeriod,
  formatSubsidyReset,
  getBindingWindow,
  getSubsidyJobTypeName,
  isSubsidyToken,
  SubsidyJobType,
} from '@/lib/subsidy';
import { useIsNodeSubsidized, useSubsidyProgram, useSubsidyQuote, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import classNames from 'classnames';
import posthog from 'posthog-js';
import { ReactNode, useEffect } from 'react';
import styles from './payment-summary.module.css';

type SubsidyTone = 'accent' | 'error' | 'neutral' | 'success' | 'warning';

type SubsidyRowProps = {
  description: ReactNode;
  end?: ReactNode;
  icon: ReactNode;
  jobType: SubsidyJobType;
  state: SubsidyPaymentState;
  title: ReactNode;
  tone: SubsidyTone;
};

const SubsidyRow = ({ description, end, icon, jobType, state, title, tone }: SubsidyRowProps) => {
  useEffect(() => {
    posthog.capture('subsidy_payment_state_shown', { jobType: getSubsidyJobTypeName(jobType), state });
  }, [jobType, state]);

  return (
    <div className={classNames(styles.subsidyRow, styles[`subsidy-${tone}`])}>
      <span className={styles.subsidyIcon}>{icon}</span>
      <div className={styles.subsidyText}>
        <strong className={styles.subsidyTitle}>{title}</strong>
        <span className={styles.subsidyDescription}>{description}</span>
      </div>
      {end ? <div className={styles.subsidyEnd}>{end}</div> : null}
    </div>
  );
};

type PaymentSubsidyProps = {
  format: (amount: number) => string;
  jobType: SubsidyJobType;
  /** The node decides which subsidy applies. */
  nodeAddress?: string;
  renderCostAfter: (cost: number) => ReactNode;
  tokenAddress: string;
  totalCost: number;
};

/** Amounts are quotes; the lock settles the final figure. */
const PaymentSubsidy = ({
  format,
  jobType,
  nodeAddress,
  renderCostAfter,
  tokenAddress,
  totalCost,
}: PaymentSubsidyProps) => {
  const { subsidyInfo } = useProfileContext();
  const { data: program, isError: isProgramError } = useSubsidyProgram();
  const { data: usage, isError: isUsageError } = useSubsidyUsage();
  const { data: isNodeSubsidized } = useIsNodeSubsidized(nodeAddress);
  const { data: quote, isError: isQuoteError } = useSubsidyQuote({
    cost: totalCost,
    jobType,
    nodeAddress,
    tokenAddress,
  });

  if (!isSubsidyToken(tokenAddress) || totalCost <= 0) {
    return null;
  }

  if (isProgramError || isUsageError || isQuoteError) {
    return (
      <SubsidyRow
        description="This job is priced in full for now. Reload the page to try again."
        icon={<ErrorOutlineIcon fontSize="small" />}
        jobType={jobType}
        state="load_error"
        title="Couldn't check your OPF subsidy"
        tone="error"
      />
    );
  }

  if (!program || !usage) {
    return null;
  }

  const amount = (value: number) => (
    <span className={styles.rowAmountGroup}>
      <span className={styles.subsidyAmount}>−{format(value)}</span>
      <span className={styles.rowSymbol}>{SUBSIDY_TOKEN_SYMBOL}</span>
    </span>
  );

  const summary = getProgramSummary(program);
  const limits = getDiscountLimitsLabel(program);

  // Sign-up progress only picks the call to action.
  if (!usage.userAllowed) {
    if (!subsidyInfo) {
      return null;
    }
    if (subsidyInfo.status === null) {
      return (
        <SubsidyRow
          description={`Verify your email to claim the OPF subsidy.${limits ? ` The discount is capped ${limits}.` : ''}`}
          end={
            <Button
              color="accent1"
              href="/subsidy/details"
              onClick={() => captureSubsidyCtaClick('payment', 'details', jobType)}
              size="sm"
              variant="outlined"
            >
              Get a subsidy
            </Button>
          }
          icon={<ShieldOutlinedIcon fontSize="small" />}
          jobType={jobType}
          state="not_signed_up"
          title={`Get ${summary} on jobs like this`}
          tone="accent"
        />
      );
    }
    if (subsidyInfo.status !== SubsidyStatus.CLAIMED) {
      const nextStep = subsidyInfo.status === SubsidyStatus.PENDING ? 'verify' : 'claim';
      return (
        <SubsidyRow
          description={`This job is charged in full. Verify your email and claim to get ${summary}.`}
          end={
            <Button
              color="accent1"
              href={`/subsidy/${nextStep}`}
              onClick={() => captureSubsidyCtaClick('payment', nextStep, jobType)}
              size="sm"
              variant="outlined"
            >
              Continue
            </Button>
          }
          icon={<ScheduleIcon fontSize="small" />}
          jobType={jobType}
          state="signup_incomplete"
          title="Finish getting your subsidy to use it on this job"
          tone="neutral"
        />
      );
    }
    return (
      <SubsidyRow
        description="This job is charged in full until your wallet is added to the subsidy list."
        icon={<ScheduleIcon fontSize="small" />}
        jobType={jobType}
        state="not_on_list"
        title="Your subsidy isn't active yet"
        tone="neutral"
      />
    );
  }

  if (usage.paused) {
    return (
      <SubsidyRow
        description="The program is paused or out of funds. This job is charged in full."
        end={<span className="chip chipError">Unavailable</span>}
        icon={<PauseIcon fontSize="small" />}
        jobType={jobType}
        state="paused"
        title="OPF subsidy is unavailable right now"
        tone="error"
      />
    );
  }

  if (isNodeSubsidized === undefined || !quote) {
    return null;
  }

  if (!isNodeSubsidized) {
    return (
      <SubsidyRow
        description="This job is charged in full. Pick a subsidized node to use your subsidy."
        icon={<InfoOutlinedIcon fontSize="small" />}
        jobType={jobType}
        state="node_not_subsidized"
        title="This node doesn't accept the OPF subsidy"
        tone="neutral"
      />
    );
  }

  const costAfter = Math.max(0, totalCost - quote.total);
  const discountWindow = usage.discount ? getBindingWindow(usage.discount.windows) : null;
  const windowLabel = discountWindow ? formatSubsidyPeriod(discountWindow.periodSeconds) : null;
  const resetLabel = discountWindow?.resetsAt ? ` It resets ${formatSubsidyReset(discountWindow.resetsAt)}.` : '';

  if (quote.total <= 0) {
    return (
      <SubsidyRow
        description={`This job is charged in full.${resetLabel}`}
        end={<span className="chip chipWarning">Limit reached</span>}
        icon={<ScheduleIcon fontSize="small" />}
        jobType={jobType}
        state="limit_reached"
        title={
          discountWindow
            ? `Discount limit reached: ${format(discountWindow.limit)} of ${format(discountWindow.limit)} ${SUBSIDY_TOKEN_SYMBOL} used this ${windowLabel}`
            : 'Your subsidy is used up'
        }
        tone="warning"
      />
    );
  }

  if (discountWindow && quote.discount < quote.uncappedDiscount - 1e-6) {
    return (
      <>
        <SubsidyRow
          description={`This job reaches your ${windowLabel} limit (${format(discountWindow.limit)} ${SUBSIDY_TOKEN_SYMBOL}). You pay ${format(costAfter)} ${SUBSIDY_TOKEN_SYMBOL}.${resetLabel}`}
          end={amount(quote.total)}
          icon={<ScheduleIcon fontSize="small" />}
          jobType={jobType}
          state="capped"
          title={`OPF subsidy: ${format(quote.total)} ${SUBSIDY_TOKEN_SYMBOL} instead of ${format(quote.oneTime + quote.uncappedDiscount)}`}
          tone="warning"
        />
        {renderCostAfter(costAfter)}
      </>
    );
  }

  const discountPercent = program.discount ? formatSubsidyAmount(program.discount.percent) : '';
  let title: string;
  let description: string;
  if (quote.discount <= 0) {
    const creditLeft = `${format(Math.max(0, (usage.oneTime?.remaining ?? 0) - quote.oneTime))} ${SUBSIDY_TOKEN_SYMBOL} of it left after this job.`;
    if (costAfter <= 0) {
      title = 'OPF subsidy: this job is on us';
      description = `Paid up front from your one-time credit, so it doesn't need to be in your escrow. ${creditLeft}`;
    } else {
      title = `OPF subsidy: ${format(quote.oneTime)} ${SUBSIDY_TOKEN_SYMBOL} on us`;
      description = `Paid up front from your one-time credit, so only your part needs to be in escrow. ${creditLeft}`;
    }
  } else if (quote.oneTime > 0) {
    title = `OPF subsidy: ${format(quote.oneTime)} ${SUBSIDY_TOKEN_SYMBOL} on us, then ${discountPercent}% off the rest`;
    description =
      'Paid up front when the job starts, so only your part needs to be in escrow. This uses the rest of your free credit.';
  } else {
    title = `OPF subsidy: ${discountPercent}% off this job`;
    description = `Paid up front when the job starts, so only your part needs to be in escrow.${
      discountWindow
        ? ` After this job (estimate): ${format(discountWindow.used + quote.discount)} of ${format(discountWindow.limit)} ${SUBSIDY_TOKEN_SYMBOL} discount used this ${windowLabel}.`
        : ''
    }`;
  }

  return (
    <>
      <SubsidyRow
        description={description}
        end={amount(quote.total)}
        icon={<VerifiedUserOutlinedIcon fontSize="small" />}
        jobType={jobType}
        state="applied"
        title={title}
        tone="success"
      />
      {renderCostAfter(costAfter)}
    </>
  );
};

export default PaymentSubsidy;
