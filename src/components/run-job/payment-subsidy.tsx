import Button from '@/components/button/button';
import {
  SUBSIDY_DISCOUNT_PERCENT,
  SUBSIDY_ONE_TIME_CREDIT,
  SUBSIDY_TOKEN_SYMBOL,
  SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
} from '@/constants/subsidy';
import { getSupportedTokens } from '@/constants/tokens';
import { useProfileContext } from '@/context/profile-context';
import { formatSubsidyReset, quoteSubsidy, useIsNodeSubsidized, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import classNames from 'classnames';
import { ReactNode } from 'react';
import styles from './payment-summary.module.css';

type SubsidyTone = 'accent' | 'error' | 'neutral' | 'success' | 'warning';

type SubsidyRowProps = {
  description: ReactNode;
  end?: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  tone: SubsidyTone;
};

const SubsidyRow = ({ description, end, icon, title, tone }: SubsidyRowProps) => (
  <div className={classNames(styles.subsidyRow, styles[`subsidy-${tone}`])}>
    <span className={styles.subsidyIcon}>{icon}</span>
    <div className={styles.subsidyText}>
      <strong className={styles.subsidyTitle}>{title}</strong>
      <span className={styles.subsidyDescription}>{description}</span>
    </div>
    {end ? <div className={styles.subsidyEnd}>{end}</div> : null}
  </div>
);

type PaymentSubsidyProps = {
  format: (amount: number) => string;
  /** Node (consumer) address of the selected environment; the node decides which subsidy applies. */
  nodeAddress?: string;
  /** Renders the "Your cost after subsidy" row under the subsidy row. */
  renderCostAfter: (cost: number) => ReactNode;
  tokenAddress: string;
  totalCost: number;
};

/**
 * The OPF subsidy line of the payment summary: what the subsidy covers for this payment, or why it
 * doesn't apply. Display only — the amounts are estimates of what the subsidy contract pays at lock.
 */
const PaymentSubsidy = ({ format, nodeAddress, renderCostAfter, tokenAddress, totalCost }: PaymentSubsidyProps) => {
  const { subsidyInfo } = useProfileContext();
  const { data: usage } = useSubsidyUsage();
  const { data: isNodeSubsidized } = useIsNodeSubsidized(nodeAddress);

  const isSubsidizedToken = tokenAddress.toLowerCase() === getSupportedTokens().USDC.address.toLowerCase();

  if (!isSubsidizedToken || !subsidyInfo || totalCost <= 0) {
    return null;
  }

  const amount = (value: number) => (
    <span className={styles.rowAmountGroup}>
      <span className={styles.subsidyAmount}>−{format(value)}</span>
      <span className={styles.rowSymbol}>{SUBSIDY_TOKEN_SYMBOL}</span>
    </span>
  );

  if (subsidyInfo.status === null) {
    return (
      <SubsidyRow
        description={`Verify your email to claim the OPF subsidy. The discount is capped at ${SUBSIDY_WEEKLY_DISCOUNT_LIMIT} ${SUBSIDY_TOKEN_SYMBOL} a week.`}
        end={
          <Button color="accent1" href="/subsidy/details" size="sm" variant="outlined">
            Get a subsidy
          </Button>
        }
        icon={<ShieldOutlinedIcon fontSize="small" />}
        title={`Get ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us and a ${SUBSIDY_DISCOUNT_PERCENT}% discount on jobs like this`}
        tone="accent"
      />
    );
  }

  if (subsidyInfo.status !== SubsidyStatus.CLAIMED) {
    return (
      <SubsidyRow
        description={`This job is charged in full. Verify your email and claim to get ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us and a ${SUBSIDY_DISCOUNT_PERCENT}% discount.`}
        end={
          <Button
            color="accent1"
            href={subsidyInfo.status === SubsidyStatus.PENDING ? '/subsidy/verify' : '/subsidy/claim'}
            size="sm"
            variant="outlined"
          >
            Continue
          </Button>
        }
        icon={<ScheduleIcon fontSize="small" />}
        title="Finish getting your subsidy to use it on this job"
        tone="neutral"
      />
    );
  }

  if (!usage || isNodeSubsidized === undefined) {
    return null;
  }

  const resetLabel = formatSubsidyReset(usage.discount.resetsAt);

  if (usage.paused || !usage.userAllowed) {
    return (
      <SubsidyRow
        description="The program is paused or out of funds. This job is charged in full."
        end={<span className="chip chipError">Unavailable</span>}
        icon={<PauseIcon fontSize="small" />}
        title="OPF subsidy is unavailable right now"
        tone="error"
      />
    );
  }

  if (!isNodeSubsidized) {
    return (
      <SubsidyRow
        description={`This job is charged in full. Pick a subsidized node to get your ${SUBSIDY_DISCOUNT_PERCENT}% discount (${format(usage.discount.remaining)} ${SUBSIDY_TOKEN_SYMBOL} left this week).`}
        icon={<InfoOutlinedIcon fontSize="small" />}
        title="This node doesn't accept the OPF subsidy"
        tone="neutral"
      />
    );
  }

  const quote = quoteSubsidy(totalCost, usage);
  const costAfter = Math.max(0, totalCost - quote.total);

  if (quote.total <= 0) {
    return (
      <SubsidyRow
        description={`This job is charged in full. Your limit resets ${resetLabel}.`}
        end={<span className="chip chipWarning">Limit reached</span>}
        icon={<ScheduleIcon fontSize="small" />}
        title={`Weekly discount limit reached: ${usage.discount.limit} of ${usage.discount.limit} ${SUBSIDY_TOKEN_SYMBOL} used`}
        tone="warning"
      />
    );
  }

  if (quote.discount < quote.uncappedDiscount) {
    return (
      <>
        <SubsidyRow
          description={`This job reaches your weekly limit (${usage.discount.limit} ${SUBSIDY_TOKEN_SYMBOL}). You pay ${format(costAfter)} ${SUBSIDY_TOKEN_SYMBOL}. The limit resets ${resetLabel}.`}
          end={amount(quote.total)}
          icon={<ScheduleIcon fontSize="small" />}
          title={`OPF subsidy: ${format(quote.total)} ${SUBSIDY_TOKEN_SYMBOL} instead of ${format(quote.oneTime + quote.uncappedDiscount)}`}
          tone="warning"
        />
        {renderCostAfter(costAfter)}
      </>
    );
  }

  const oneTimeLeftAfter = usage.oneTime.remaining - quote.oneTime;
  const discountUsedAfter = usage.discount.used + quote.discount;

  let title: string;
  let description: string;
  if (quote.discount <= 0) {
    title = 'OPF subsidy: this job is on us';
    description = `Paid up front from your ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us, so it doesn't need to be in your escrow. ${format(oneTimeLeftAfter)} ${SUBSIDY_TOKEN_SYMBOL} of it left after this job.`;
  } else if (quote.oneTime > 0) {
    title = `OPF subsidy: ${format(quote.oneTime)} ${SUBSIDY_TOKEN_SYMBOL} on us, then ${SUBSIDY_DISCOUNT_PERCENT}% off the rest`;
    description = `Paid up front when the job starts, so only your part needs to be in escrow. This uses the rest of your ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us.`;
  } else {
    title = `OPF subsidy: ${SUBSIDY_DISCOUNT_PERCENT}% discount on this job`;
    description = `Paid up front when the job starts, so only your part needs to be in escrow. After this job (estimate): ${format(discountUsedAfter)} of ${usage.discount.limit} ${SUBSIDY_TOKEN_SYMBOL} discount used this week.`;
  }

  return (
    <>
      <SubsidyRow
        description={description}
        end={amount(quote.total)}
        icon={<VerifiedUserOutlinedIcon fontSize="small" />}
        title={title}
        tone="success"
      />
      {renderCostAfter(costAfter)}
    </>
  );
};

export default PaymentSubsidy;
