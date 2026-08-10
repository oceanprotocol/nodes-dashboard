import Button from '@/components/button/button';
import Card from '@/components/card/card';
import SwapTokensModal from '@/components/swap-tokens/swap-tokents-modal';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedToken } from '@/context/run-job-context';
import { Authorizations } from '@/types/payment';
import { formatTokenAmount, sharedTokenAmountDecimals } from '@/utils/formatters';
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
  totalCost: number;
  walletBalance: number;
};

// One label/value line in the ledger below the hero. `action` renders after the value (the
// "Get more COMPY" link); `chip` renders before it, so warnings sit next to what they qualify.
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
  totalCost,
  walletBalance,
}: PaymentSummaryProps) => {
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  const tokenSymbol = selectedToken.symbol;

  const currentLocked = Number(authorizations?.currentLockedAmount ?? 0);
  const maxLocked = Number(authorizations?.maxLockedAmount ?? 0);
  const escrow = escrowBalance ?? 0;

  const insufficientAutorized = (Number(authorizations?.maxLockedAmount) ?? 0) < totalCost;
  const insufficientEscrow = escrowBalance !== null && escrowBalance < totalCost;

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

  // No `padding` prop on the Card: the hero band spans the full width, so this component owns its
  // own insets rather than cancelling the card's with negative margins.
  return (
    <Card className={styles.summary} radius="sm" variant="accent1-outline">
      {/* Hero: the number the user is actually deciding on. Spans the full card width so it reads
          as its own zone rather than the first row of the ledger. */}
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>Estimated total cost</span>
          {insufficientEscrow ? <span className={styles.heroHint}>Top up escrow to authorize this job</span> : null}
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
          chip={insufficientEscrow ? <span className="chip chipError">Insufficient funds</span> : null}
          error={insufficientEscrow}
          label="Available in escrow"
          symbol={tokenSymbol}
          value={format(escrow)}
        />

        <Collapse in={isDetailsOpen}>
          <SummaryRow label="Locked now" symbol={tokenSymbol} value={format(currentLocked)} />
          <SummaryRow
            chip={insufficientAutorized ? <span className="chip chipError">Insufficient authorization</span> : null}
            error={insufficientAutorized}
            label="Max locked"
            symbol={tokenSymbol}
            value={format(maxLocked)}
          />
        </Collapse>

        {/* Wallet balance closes the ledger in both states — the limits above it expand in place. */}
        <SummaryRow
          action={
            isCompy ? (
              <button className={styles.linkButton} onClick={() => setIsSwapModalOpen(true)} type="button">
                Get more COMPY
              </button>
            ) : null
          }
          label="Available in wallet"
          muted
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
