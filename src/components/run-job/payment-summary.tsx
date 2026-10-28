import Button from '@/components/button/button';
import Card from '@/components/card/card';
import PaymentSubsidy from '@/components/run-job/payment-subsidy';
import { BASE_CHAIN_ID, CHAIN_ID } from '@/constants/chains';
import { USDC } from '@/constants/tokens';
import { SubsidyJobType } from '@/lib/subsidy';
import { useSubsidyQuote } from '@/lib/use-subsidy';
import { DEFAULT_TOPUP_EUR, useCardTopup } from '@/lib/use-usdc-topup';
import { Authorizations } from '@/types/payment';
import { formatTokenAmount, roundTokenAmount, sharedTokenAmountDecimals } from '@/utils/formatters';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './payment-summary.module.css';

type PaymentSummaryProps = {
  authorizations: Authorizations | null;
  escrowBalance: number | null;
  loadPaymentInfo: () => void;
  subsidyJobType: SubsidyJobType;
  nodeAddress?: string;
  /** Which payment step renders this, for the card top-up's analytics. */
  topupSource: 'run_job' | 'inference';
  totalCost: number;
  walletBalance: number;
};

// One label/value line in the ledger below the hero. `action` renders after the value (the
// "Top up with card" link); `chip` renders before it, so warnings sit next to what they qualify.
const SummaryRow = ({
  action,
  chip,
  error,
  label,
  muted,
  symbol,
  value,
}: {
  action?: React.ReactNode;
  chip?: React.ReactNode;
  error?: boolean;
  label: React.ReactNode;
  muted?: boolean;
  symbol: string;
  value: string;
}) => (
  <div className={classNames(styles.row, { [styles.rowMuted]: muted })}>
    <span className={styles.rowLabel}>{label}</span>
    <div className={styles.rowValue}>
      <span className={styles.rowAmountGroup}>
        <span className={classNames(styles.rowAmount, { textErrorDarker: error })}>{value}</span>
        <span className={styles.rowSymbol}>{symbol}</span>
      </span>
      {chip}
    </div>
    {action}
  </div>
);

const PaymentSummary = ({
  authorizations,
  escrowBalance,
  loadPaymentInfo,
  nodeAddress,
  subsidyJobType,
  topupSource,
  totalCost,
  walletBalance,
}: PaymentSummaryProps) => {
  // Re-reading payment info once the USDC lands clears the shortfall and unblocks the pay button.
  const { canTopup, isToppingUp, startTopup, waitingForUsdc } = useCardTopup({
    source: topupSource,
    onArrived: loadPaymentInfo,
  });

  const { data: subsidyQuote } = useSubsidyQuote({
    cost: totalCost,
    jobType: subsidyJobType,
    nodeAddress,
  });

  const currentLocked = Number(authorizations?.currentLockedAmount ?? 0);
  const maxLocked = Number(authorizations?.maxLockedAmount ?? 0);
  const escrow = escrowBalance ?? 0;

  // Both shortfalls below are handled by the pay button itself: it deposits the missing funds from
  // the wallet and re-authorizes in the same transaction. So they're only errors when the wallet
  // can't cover the deposit; otherwise they're what the payment is about to do, not a blocker.
  // Rounded like computeEscrowRequirement, so this agrees with the button's own gate.
  const payerCost = Math.max(0, totalCost - (subsidyQuote?.total ?? 0));
  const insufficientAutorized = maxLocked < payerCost + currentLocked;
  const insufficientEscrow = escrowBalance !== null && escrowBalance < payerCost;
  const depositGap = roundTokenAmount(Math.max(0, payerCost - escrow), USDC.address, 'up');
  const insufficientWallet = insufficientEscrow && walletBalance < depositGap;

  // The collapsed rows are limits — irrelevant while they're comfortably satisfied, worth seeing
  // up front when they aren't, or when funds are already locked from an earlier session.
  const detailsRelevant = insufficientAutorized || currentLocked > 0;

  // `null` until the user clicks the toggle, so open-ness follows `detailsRelevant` as `authorizations`
  // loads in — deriving it avoids latching the pre-load value the way a useState initializer would.
  // Once clicked, the explicit choice wins and stops tracking.
  const [detailsOpenByUser, setDetailsOpenByUser] = useState<boolean | null>(null);
  const isDetailsOpen = detailsOpenByUser ?? detailsRelevant;

  // Every amount renders with as many decimals as the most precise one, so the column lines up
  // without padding values to a fixed width they don't need.
  const decimals = sharedTokenAmountDecimals(
    [
      totalCost,
      escrow,
      currentLocked,
      maxLocked,
      walletBalance,
      subsidyQuote?.total ?? 0,
      subsidyQuote?.oneTime ?? 0,
      subsidyQuote?.discount ?? 0,
      ...(subsidyQuote?.custom.map((entry) => entry.amount) ?? []),
      payerCost,
    ],
    USDC.address
  );
  const format = (amount: number) => formatTokenAmount(amount, USDC.address, decimals);

  // The card on-ramp only delivers USDC on Base, which keeps it out of dev, where payments use
  // Sepolia USDC. Smart-account users only (canTopup).
  const showTopup = insufficientWallet && CHAIN_ID === BASE_CHAIN_ID && canTopup;

  const walletAction = waitingForUsdc ? (
    <span className={styles.topupStatus}>Waiting for your USDC…</span>
  ) : showTopup ? (
    <button
      className={styles.linkButton}
      disabled={isToppingUp}
      onClick={() => startTopup(DEFAULT_TOPUP_EUR)}
      type="button"
    >
      {isToppingUp ? 'Opening checkout…' : 'Top up with card'}
    </button>
  ) : null;

  // No `padding` prop on the Card: the hero band spans the full width, so this component owns its
  // own insets rather than cancelling the card's with negative margins.
  return (
    <Card className={styles.summary} radius="sm" variant="accent1-outline">
      {/* Hero: the number the user is actually deciding on. Spans the full card width so it reads
          as its own zone rather than the first row of the ledger. */}
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>Estimated total cost</span>
          {insufficientWallet ? (
            <span className={styles.heroHint}>
              Not enough {USDC.symbol} in your wallet: add {format(depositGap - walletBalance)} {USDC.symbol} to pay
            </span>
          ) : insufficientEscrow ? (
            <span className={styles.heroHint}>
              Paying moves {format(depositGap)} {USDC.symbol} from your wallet to escrow
            </span>
          ) : null}
        </div>
        <div className={styles.heroAmount}>
          <span className={styles.heroValue}>{format(totalCost)}</span>
          <span className={styles.heroSymbol}>{USDC.symbol}</span>
        </div>
      </div>

      {/* Ledger: the balances and limits that explain whether the cost above can be covered. Only the
          escrow and wallet rows show by default; the limits sit behind the details toggle, which
          closes the card. */}
      <div className={styles.rows}>
        <PaymentSubsidy
          format={format}
          jobType={subsidyJobType}
          nodeAddress={nodeAddress}
          renderCostAfter={(cost) => (
            <SummaryRow
              label={
                <>
                  Your cost after subsidy <span className={styles.rowLabelHint}>(estimate)</span>
                </>
              }
              symbol={USDC.symbol}
              value={format(cost)}
            />
          )}
          totalCost={totalCost}
        />

        <SummaryRow
          chip={
            insufficientWallet ? (
              <span className="chip chipError">Insufficient funds</span>
            ) : insufficientEscrow ? (
              <span className="chip chipGlass">Topped up on pay</span>
            ) : null
          }
          error={insufficientWallet}
          label="Available in escrow"
          symbol={USDC.symbol}
          value={format(escrow)}
        />

        <Collapse in={isDetailsOpen}>
          <SummaryRow label="Locked now" symbol={USDC.symbol} value={format(currentLocked)} />
          <SummaryRow
            chip={insufficientAutorized ? <span className="chip chipGlass">Raised on pay</span> : null}
            label="Max locked"
            symbol={USDC.symbol}
            value={format(maxLocked)}
          />
        </Collapse>

        {/* Wallet balance closes the ledger in both states — the limits above it expand in place. */}
        <SummaryRow
          action={walletAction}
          error={insufficientWallet}
          label="Available in wallet"
          muted={!insufficientWallet}
          symbol={USDC.symbol}
          value={format(walletBalance)}
        />

        <div className={styles.detailsRow}>
          <Button
            aria-expanded={isDetailsOpen}
            color="accent1"
            contentBefore={
              <ExpandMoreIcon
                fontSize="small"
                style={{ transform: isDetailsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            }
            onClick={() => setDetailsOpenByUser(!isDetailsOpen)}
            size="sm"
            type="button"
            variant="transparent"
          >
            {isDetailsOpen ? 'Less info' : 'More info'}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default PaymentSummary;
