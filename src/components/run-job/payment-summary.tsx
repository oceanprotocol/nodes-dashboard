import Card from '@/components/card/card';
import SwapTokensModal from '@/components/swap-tokens/swap-tokents-modal';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedToken } from '@/context/run-job-context';
import { Authorizations } from '@/types/payment';
import { formatNumber } from '@/utils/formatters';
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

  const insufficientAutorized = (Number(authorizations?.maxLockedAmount) ?? 0) < totalCost;
  const insufficientEscrow = escrowBalance !== null && escrowBalance < totalCost;

  return (
    <Card className={styles.cost} radius="md" variant="accent1-outline">
      {/* Estimated total cost */}
      <h3>Estimated total cost</h3>
      <div className={styles.values}>
        <span className={styles.token}>{tokenSymbol}</span>
        &nbsp;
        <span className={styles.amount}>{formatNumber(totalCost)}</span>
      </div>
      {/* User available funds in escrow */}
      <h3>User available funds in escrow</h3>
      <div className={styles.valueWithChip}>
        <div className={styles.values}>
          <span className={styles.token}>{tokenSymbol}</span>
          &nbsp;
          <span className={classNames(styles.amount, { textError: insufficientEscrow })}>
            {formatNumber(escrowBalance ?? 0)}
          </span>
        </div>
        {insufficientEscrow ? <div className="chip chipError">Insufficient funds</div> : null}
      </div>
      {/* Current locked amount */}
      <h3>Current locked amount</h3>
      <div className={styles.valueWithChip}>
        <div className={styles.values}>
          <span className={styles.token}>{tokenSymbol}</span>
          &nbsp;
          <span className={classNames(styles.amount)}>{formatNumber(authorizations?.currentLockedAmount ?? 0)}</span>
        </div>
      </div>
      {/* Max locked amount */}
      <h3>Max locked amount</h3>
      <div className={styles.valueWithChip}>
        <div className={styles.values}>
          <span className={styles.token}>{tokenSymbol}</span>
          &nbsp;
          <span className={classNames(styles.amount, { textError: insufficientAutorized })}>
            {formatNumber(authorizations?.maxLockedAmount ?? 0)}
          </span>
        </div>
        {insufficientAutorized ? <div className="chip chipError">Insufficient allowance</div> : null}
      </div>
      {/* User available funds in wallet */}
      <h3 className={styles.sm}>User available funds in wallet</h3>
      <div className={styles.values}>
        <div className={styles.sm}>
          <span className={styles.token}>{tokenSymbol}</span>
          &nbsp;
          <span className={classNames(styles.amount, styles.sm)}>{formatNumber(walletBalance)}</span>
        </div>
        {selectedToken.address.toLowerCase() === getSupportedTokens().COMPY.toLowerCase() ? (
          <>
            <button className={styles.linkButton} onClick={() => setIsSwapModalOpen(true)} type="button">
              Get more COMPY
            </button>
            <SwapTokensModal
              isOpen={isSwapModalOpen}
              onClose={() => setIsSwapModalOpen(false)}
              onSuccess={loadPaymentInfo}
            />
          </>
        ) : null}
      </div>
    </Card>
  );
};

export default PaymentSummary;
