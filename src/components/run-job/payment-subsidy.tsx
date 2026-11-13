import Button from '@/components/button/button';
import { captureSubsidyCtaClick, SubsidyPaymentState } from '@/components/subsidy/subsidy-analytics';
import {
  formatSubsidyAmount,
  getDiscountLimitsLabel,
  getProgramSummary,
  getSubsidyPaymentNote,
  SUBSIDY_PAYMENT_COPY,
} from '@/components/subsidy/subsidy-copy';
import SubsidyPaymentChips from '@/components/subsidy/subsidy-payment-chips';
import { USDC } from '@/constants/tokens';
import { useProfileContext } from '@/context/profile-context';
import {
  formatSubsidyPeriod,
  formatSubsidyReset,
  getBindingWindow,
  getSubsidyJobTypeName,
  SubsidyJobType,
  SubsidyPayment,
} from '@/lib/subsidy';
import { useIsNodeSubsidized, useSubsidyProgram, useSubsidyQuote, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
import { formatTokenAmount, formatWalletAddress } from '@/utils/formatters';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import RedeemIcon from '@mui/icons-material/Redeem';
import ScheduleIcon from '@mui/icons-material/Schedule';
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
  payments?: SubsidyPayment[];
  state: SubsidyPaymentState;
  title: ReactNode;
  tone: SubsidyTone;
};

const SubsidyRow = ({ description, end, icon, jobType, payments, state, title, tone }: SubsidyRowProps) => {
  useEffect(() => {
    posthog.capture('subsidy_payment_state_shown', { jobType: getSubsidyJobTypeName(jobType), state });
  }, [jobType, state]);

  return (
    <div className={classNames(styles.subsidyRow, styles[`subsidy-${tone}`])}>
      <span className={styles.subsidyIcon}>{icon}</span>
      <div className={styles.subsidyText}>
        <div className={styles.subsidyTitleRow}>
          <strong className={styles.subsidyTitle}>{title}</strong>
          {payments ? <SubsidyPaymentChips payments={payments} /> : null}
        </div>
        <span className={styles.subsidyDescription}>{description}</span>
      </div>
      {end ? <div className={styles.subsidyEnd}>{end}</div> : null}
    </div>
  );
};

const formatText = (amount: number) => formatTokenAmount(amount, USDC.address);

type PaymentSubsidyProps = {
  /** Amount column only: shares the summary's precision. Sentences use their own. */
  format: (amount: number) => string;
  isOpfEligible: boolean;
  jobType: SubsidyJobType;
  /** The node decides which subsidy applies. */
  nodeAddress?: string;
  totalCost: number;
};

/** Amounts are quotes; the lock settles the final figure. */
const PaymentSubsidy = ({ format, isOpfEligible, jobType, nodeAddress, totalCost }: PaymentSubsidyProps) => {
  const { subsidyInfo } = useProfileContext();
  const { data: program, isError: isProgramError } = useSubsidyProgram();
  const { data: usage, isError: isUsageError } = useSubsidyUsage();
  const { data: isNodeSubsidized } = useIsNodeSubsidized(nodeAddress);
  const { data: quote, isError: isQuoteError } = useSubsidyQuote({
    cost: totalCost,
    isOpfEligible,
    jobType,
    nodeAddress,
  });

  if (totalCost <= 0) {
    return null;
  }

  if (isOpfEligible && (isProgramError || isUsageError || isQuoteError)) {
    return (
      <SubsidyRow
        description="This job is priced in full for now. Reload the page to try again."
        icon={<ErrorOutlineIcon fontSize="small" />}
        jobType={jobType}
        state="load_error"
        title="Couldn't check your ON subsidy"
        tone="error"
      />
    );
  }

  const amount = (value: number) => (
    <span className={styles.rowAmountGroup}>
      <span className={styles.subsidyAmount}>−{format(value)}</span>
      <span className={styles.rowSymbol}>{USDC.symbol}</span>
    </span>
  );

  const customCovered = quote?.custom ?? [];
  const costAfter = Math.max(0, totalCost - (quote?.total ?? 0));
  const chargedInFull =
    customCovered.length > 0 ? "The ON subsidy doesn't apply to this job" : 'This job is charged in full';

  const renderOpfRow = () => {
    if (!program || !usage) {
      return null;
    }

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
            description={`Verify your email to claim the ON subsidy.${limits ? ` The discount is capped ${limits}.` : ''}`}
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
            icon={<RedeemIcon fontSize="small" />}
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
            description={`${chargedInFull}. Verify your email and claim to get ${summary}.`}
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
          description={`${chargedInFull} until your wallet is added to the subsidy list.`}
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
          description={`The program is paused or out of funds. ${chargedInFull}.`}
          end={<span className="chip chipError">Unavailable</span>}
          icon={<PauseIcon fontSize="small" />}
          jobType={jobType}
          state="paused"
          title="ON subsidy is unavailable right now"
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
          description={`${chargedInFull}. Pick a subsidized node to use your subsidy.`}
          icon={<InfoOutlinedIcon fontSize="small" />}
          jobType={jobType}
          state="node_not_subsidized"
          title="This node doesn't accept the ON subsidy"
          tone="neutral"
        />
      );
    }

    const opfTotal = quote.oneTime + quote.discount;
    const discountWindow = usage.discount ? getBindingWindow(usage.discount.windows) : null;
    const windowLabel = discountWindow ? formatSubsidyPeriod(discountWindow.periodSeconds) : null;
    const resetLabel = discountWindow?.resetsAt ? ` It resets ${formatSubsidyReset(discountWindow.resetsAt)}.` : '';

    if (opfTotal <= 0 && costAfter <= 0) {
      return null;
    }

    if (opfTotal <= 0) {
      return (
        <SubsidyRow
          description={`${chargedInFull}.${resetLabel}`}
          end={<span className="chip chipWarning">Limit reached</span>}
          icon={<ScheduleIcon fontSize="small" />}
          jobType={jobType}
          state="limit_reached"
          title={
            discountWindow
              ? `Discount limit reached: ${formatText(discountWindow.limit)} of ${formatText(discountWindow.limit)} ${USDC.symbol} used this ${windowLabel}`
              : 'Your subsidy is used up'
          }
          tone="warning"
        />
      );
    }

    if (discountWindow && quote.discount < quote.uncappedDiscount - 1e-6) {
      return (
        <SubsidyRow
          description={`This job reaches your ${windowLabel} limit (${formatText(discountWindow.limit)} ${USDC.symbol}). You pay ${formatText(costAfter)} ${USDC.symbol}.${resetLabel}`}
          end={amount(opfTotal)}
          icon={<ScheduleIcon fontSize="small" />}
          jobType={jobType}
          payments={quote.opfPayments}
          state="capped"
          title={`ON subsidy: ${formatText(opfTotal)} ${USDC.symbol} instead of ${formatText(quote.oneTime + quote.uncappedDiscount)}`}
          tone="warning"
        />
      );
    }

    const discountPercent = program.discount ? formatSubsidyAmount(program.discount.percent) : '';
    const paymentNote = getSubsidyPaymentNote(quote.opfPayments);
    let title: string;
    let description: string;
    if (quote.discount <= 0) {
      const creditLeft = `${formatText(Math.max(0, (usage.oneTime?.remaining ?? 0) - quote.oneTime))} ${USDC.symbol} will remain available after this job.`;
      if (costAfter <= 0) {
        title =
          customCovered.length > 0
            ? `ON subsidy: the remaining ${formatText(quote.oneTime)} ${USDC.symbol} on us`
            : 'ON subsidy: this job is on us';
        description = quote.opfPayments.includes('postpaid')
          ? `${paymentNote}\n${creditLeft}`
          : `Paid up front from your one-time credit, so it doesn't need to be in your escrow.\n${creditLeft}`;
      } else {
        title = `ON subsidy: ${formatText(quote.oneTime)} ${USDC.symbol} on us`;
        description = `${paymentNote}\n${creditLeft}`;
      }
    } else if (quote.oneTime > 0) {
      title = `ON subsidy: ${formatText(quote.oneTime)} ${USDC.symbol} on us, then ${discountPercent}% off the rest`;
      description = `${paymentNote} This uses the rest of your free credit.`;
    } else {
      title = `ON subsidy: ${discountPercent}% off this job`;
      description = `${paymentNote}${
        discountWindow
          ? ` After this job (estimate): ${formatText(discountWindow.used + quote.discount)} of ${formatText(discountWindow.limit)} ${USDC.symbol} discount used this ${windowLabel}.`
          : ''
      }`;
    }

    return (
      <SubsidyRow
        description={description}
        end={amount(opfTotal)}
        icon={<RedeemIcon fontSize="small" />}
        jobType={jobType}
        payments={quote.opfPayments}
        state="applied"
        title={title}
        tone="success"
      />
    );
  };

  return (
    <>
      {customCovered.map((entry) => (
        <SubsidyRow
          description={`Contract ${formatWalletAddress(entry.address)}. ${SUBSIDY_PAYMENT_COPY[entry.payment].note}`}
          end={amount(entry.amount)}
          icon={<RedeemIcon fontSize="small" />}
          jobType={jobType}
          key={entry.address}
          payments={[entry.payment]}
          state="custom_applied"
          title={`Other subsidy: ${formatText(entry.amount)} ${USDC.symbol} off`}
          tone="success"
        />
      ))}
      {isOpfEligible ? renderOpfRow() : null}
    </>
  );
};

export default PaymentSubsidy;
