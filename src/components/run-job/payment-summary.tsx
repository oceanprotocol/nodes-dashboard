import Button from '@/components/button/button';
import Card from '@/components/card/card';
import SwapTokensModal from '@/components/swap-tokens/swap-tokents-modal';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedToken } from '@/context/run-job-context';
import { BASE_USDC, DEFAULT_TOPUP_EUR, useCardTopup } from '@/lib/use-usdc-topup';
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
  selectedToken: SelectedToken;
  /** Which payment step renders this, for the card top-up's analytics. */
  topupSource: 'run_job' | 'inference';
  totalCost: number;
  walletBalance: number;
};

// One label/value line in the ledger below the hero. `action` renders after the value (the
// "Get more COMPY" / "Top up with card" link); `chip` renders before it, so warnings sit next to what they qualify.
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
  label: string;
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
  selectedToken,
  topupSource,
  totalCost,
  walletBalance,
}: PaymentSummaryProps) => {
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  // Re-reading payment info once the USDC lands clears the shortfall and unblocks the pay button.
  const { canTopup, isToppingUp, startTopup, waitingForUsdc } = useCardTopup({
    source: topupSource,
    onArrived: loadPaymentInfo,
  });

  const tokenSymbol = selectedToken.symbol;

  const currentLocked = Number(authorizations?.currentLockedAmount ?? 0);
  const maxLocked = Number(authorizations?.maxLockedAmount ?? 0);
  const escrow = escrowBalance ?? 0;

  // Both shortfalls below are handled by the pay button itself: it deposits the missing funds from
  // the wallet and re-authorizes in the same transaction. So they're only errors when the wallet
  // can't cover the deposit; otherwise they're what the payment is about to do, not a blocker.
  // Rounded like computeEscrowRequirement, so this agrees with the button's own gate.
  const insufficientAutorized = maxLocked < totalCost + currentLocked;
  const insufficientEscrow = escrowBalance !== null && escrowBalance < totalCost;
  const depositGap = roundTokenAmount(Math.max(0, totalCost - escrow), selectedToken.address, 'up');
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
    [totalCost, escrow, currentLocked, maxLocked, walletBalance],
    selectedToken.address
  );
  const format = (amount: number) => formatTokenAmount(amount, selectedToken.address, decimals);

  const isCompy = selectedToken.address.toLowerCase() === getSupportedTokens().COMPY.address.toLowerCase();

  // The card on-ramp only delivers USDC on Base, so it can only cover a Base USDC payment. That also keeps it
  // out of dev, where payments use Sepolia USDC. Smart-account users only (canTopup).
  const isBaseUsdc = selectedToken.address.toLowerCase() === BASE_USDC.address.toLowerCase();
  const showTopup = insufficientWallet && isBaseUsdc && canTopup;

  const walletAction = isCompy ? (
    <button className={styles.linkButton} onClick={() => setIsSwapModalOpen(true)} type="button">
      Get more COMPY
    </button>
  ) : waitingForUsdc ? (
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
              Not enough {tokenSymbol} in your wallet: add {format(depositGap - walletBalance)} {tokenSymbol} to pay
            </span>
          ) : insufficientEscrow ? (
            <span className={styles.heroHint}>
              Paying moves {format(depositGap)} {tokenSymbol} from your wallet to escrow
            </span>
          ) : null}
        </div>
        <div className={styles.heroAmount}>
          <span className={styles.heroValue}>{format(totalCost)}</span>
          <span className={styles.heroSymbol}>{tokenSymbol}</span>
        </div>
      </div>

      {/* Ledger: the balances and limits that explain whether the cost above can be covered. Only the
          escrow and wallet rows show by default; the limits sit behind the details toggle, which
          closes the card. */}
      <div className={styles.rows}>
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
          symbol={tokenSymbol}
          value={format(escrow)}
        />

        <Collapse in={isDetailsOpen}>
          <SummaryRow label="Locked now" symbol={tokenSymbol} value={format(currentLocked)} />
          <SummaryRow
            chip={insufficientAutorized ? <span className="chip chipGlass">Raised on pay</span> : null}
            label="Max locked"
            symbol={tokenSymbol}
            value={format(maxLocked)}
          />
        </Collapse>

        {/* Wallet balance closes the ledger in both states — the limits above it expand in place. */}
        <SummaryRow
          action={walletAction}
          error={insufficientWallet}
          label="Available in wallet"
          muted={!insufficientWallet}
          symbol={tokenSymbol}
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

      {isCompy ? (
        <SwapTokensModal
          isOpen={isSwapModalOpen}
          onClose={() => setIsSwapModalOpen(false)}
          onSuccess={loadPaymentInfo}
        />
      ) : null}
    </Card>
  );
};

export default PaymentSummary;
