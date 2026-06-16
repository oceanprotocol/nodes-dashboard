import Button from '@/components/button/button';
import Card from '@/components/card/card';
import EditAuthorizationModal from '@/components/escrow/edit-authorization-modal';
import Input from '@/components/input/input';
import { useDepositTokens } from '@/lib/use-deposit-tokens';
import { EscrowSpenderInfo, EscrowTokenInfo } from '@/lib/use-escrow-data';
import { useWithdrawTokens } from '@/lib/use-withdraw-tokens';
import { formatDateTime, formatDuration, formatTokenAmount, formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import { useFormik } from 'formik';
import { useState } from 'react';
import * as Yup from 'yup';
import styles from './escrow-token-panel.module.css';

type EscrowTokenPanelProps = {
  token: EscrowTokenInfo;
  spender: EscrowSpenderInfo | null;
  loadingSpenders: boolean;
  onChange: () => void;
};

type AmountFormValues = {
  amount: number;
};

// Inline SVG pencil icon for Edit button
const PencilSvg = () => (
  <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

// Inline SVG upload icon for Deposit
const UploadSvg = () => (
  <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
  </svg>
);

// Inline SVG download icon for Withdraw
const DownloadSvg = () => (
  <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

const EscrowTokenPanel = ({ token, spender, loadingSpenders, onChange }: EscrowTokenPanelProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { handleDeposit, isDepositing } = useDepositTokens({ onSuccess: onChange });
  const { handleWithdraw, isWithdrawing } = useWithdrawTokens({ onSuccess: onChange });

  const depositForm = useFormik<AmountFormValues>({
    initialValues: { amount: 0 },
    onSubmit: (values) => {
      handleDeposit({ tokenAddress: token.address, amount: values.amount.toString() });
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number()
        .required('Required')
        .moreThan(0, 'Invalid amount')
        .max(token.walletBalance, 'Exceeds wallet balance'),
    }),
  });

  const withdrawForm = useFormik<AmountFormValues>({
    initialValues: { amount: 0 },
    onSubmit: (values) => {
      handleWithdraw({ tokenAddresses: [token.address], amounts: [values.amount.toString()] });
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number()
        .required('Required')
        .moreThan(0, 'Invalid amount')
        .max(token.available, 'Exceeds available funds'),
    }),
  });

  const auth = spender?.authorizations ?? null;
  const locks = spender?.locks ?? [];
  const locksUsed = auth ? Number(auth.currentLocks) : 0;
  const locksMax = auth ? Number(auth.maxLockCounts) : 0;
  const locksPct = locksMax > 0 ? Math.min(100, (locksUsed / locksMax) * 100) : 0;

  return (
    <Card direction="column" padding="lg" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.panel}>
        {/* ── Left: balance + move funds ── */}
        <div className={styles.left}>
          {/* Token header */}
          <div className={styles.tokenHeader}>
            <span className={styles.tokenSymbol}>{token.symbol}</span>
          </div>

          {/* Primary balance */}
          <div className={styles.primaryBalance}>
            <span className={styles.overline}>Available in escrow</span>
            <div className={styles.primaryAmount}>
              <span className={styles.primaryValue}>{formatTokenAmount(token.available, token.address)}</span>
              <span className={styles.primarySymbol}>{token.symbol}</span>
            </div>
          </div>

          {/* Secondary balances */}
          <div className={styles.secondaryBalances}>
            <div className={styles.secondaryRow}>
              <span className={styles.secondaryLabel}>Locked in escrow</span>
              <span className={styles.secondaryAmount}>
                <strong>{formatTokenAmount(token.locked, token.address)}</strong>{' '}
                <span className={styles.secondarySymbol}>{token.symbol}</span>
              </span>
            </div>
            <div className={styles.secondaryRow}>
              <span className={styles.secondaryLabel}>Available in wallet</span>
              <span className={styles.secondaryAmount}>
                <strong>{formatTokenAmount(token.walletBalance, token.address)}</strong>{' '}
                <span className={styles.secondarySymbol}>{token.symbol}</span>
              </span>
            </div>
          </div>

          {/* Move funds */}
          <div className={styles.moveFunds}>
            <span className={styles.overline}>Move funds</span>
            <form className={styles.fundRow} onSubmit={depositForm.handleSubmit}>
              <Input
                endAdornment={token.symbol}
                errorText={
                  depositForm.touched.amount && depositForm.errors.amount ? depositForm.errors.amount : undefined
                }
                label="Deposit"
                name="amount"
                onBlur={depositForm.handleBlur}
                onChange={depositForm.handleChange}
                size="sm"
                step="any"
                type="number"
                value={depositForm.values.amount}
              />
              <Button
                color="accent1"
                contentBefore={<UploadSvg />}
                disabled={!depositForm.isValid || isDepositing}
                loading={isDepositing}
                size="md"
                type="submit"
              >
                Deposit
              </Button>
            </form>
            <form className={styles.fundRow} onSubmit={withdrawForm.handleSubmit}>
              <Input
                endAdornment={token.symbol}
                errorText={
                  withdrawForm.touched.amount && withdrawForm.errors.amount ? withdrawForm.errors.amount : undefined
                }
                label="Withdraw"
                name="amount"
                onBlur={withdrawForm.handleBlur}
                onChange={withdrawForm.handleChange}
                size="sm"
                step="any"
                type="number"
                value={withdrawForm.values.amount}
              />
              <Button
                color="accent1"
                contentBefore={<DownloadSvg />}
                disabled={!withdrawForm.isValid || isWithdrawing}
                loading={isWithdrawing}
                size="md"
                type="submit"
                variant="outlined"
              >
                Withdraw
              </Button>
            </form>
          </div>
        </div>

        {/* ── Right: authorization & locks ── */}
        <div className={styles.right}>
          {loadingSpenders && !auth ? (
            <div className={styles.authLoading}>
              <CircularProgress size={28} />
            </div>
          ) : auth ? (
            <>
              {/* Auth header */}
              <div className={styles.authHeader}>
                <div>
                  <span className={styles.authTitle}>Spending authorization</span>
                  {spender ? (
                    <span className={styles.authSpender}>Spender {formatWalletAddress(spender.spender)}</span>
                  ) : null}
                </div>
                <Button
                  color="primary"
                  contentBefore={<PencilSvg />}
                  onClick={() => setIsEditOpen(true)}
                  size="sm"
                  variant="outlined"
                >
                  Edit
                </Button>
              </div>

              {/* Stats grid */}
              <div className={styles.statsGrid}>
                <div className={styles.statField}>
                  <span className={styles.statLabel}>Max locked amount</span>
                  <span className={styles.statValue}>
                    {formatTokenAmount(Number(auth.maxLockedAmount), token.address)} {token.symbol}
                  </span>
                </div>
                <div className={styles.statField}>
                  <span className={styles.statLabel}>Currently locked</span>
                  <span className={styles.statValue}>
                    {formatTokenAmount(Number(auth.currentLockedAmount), token.address)} {token.symbol}
                  </span>
                </div>
                <div className={styles.statField}>
                  <span className={styles.statLabel}>Max lock duration</span>
                  <span className={styles.statValue}>{formatDuration(Number(auth.maxLockSeconds), true)}</span>
                </div>
                <div className={styles.statField}>
                  <span className={styles.statLabel}>Locks used</span>
                  <span className={styles.statValue}>
                    {locksUsed} / {locksMax}
                  </span>
                  <div className={styles.locksBar}>
                    <div className={styles.locksBarFill} style={{ width: `${locksPct}%` }} />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className={styles.divider} />

              {/* Active locks */}
              <div className={styles.locksSection}>
                <div className={styles.locksHeader}>
                  <span className={styles.overline}>Active locks</span>
                  {locks.length > 0 && <span className={styles.locksChip}>{locks.length}</span>}
                </div>
                {locks.length > 0 ? (
                  <div className={styles.locksTable}>
                    <div className={styles.locksTableHeader}>
                      <span>Job</span>
                      <span className={styles.centerCol}>Amount</span>
                      <span className={styles.rightCol}>Expires</span>
                    </div>
                    {locks.map((lock) => (
                      <div className={styles.lockRow} key={lock.jobId}>
                        <span className={styles.lockJob}>{formatWalletAddress(lock.jobId)}</span>
                        <span className={styles.centerCol}>
                          {formatTokenAmount(lock.amount, token.address)} {token.symbol}
                        </span>
                        <span className={`${styles.rightCol} ${styles.lockExpiry}`}>{formatDateTime(lock.expiry)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noLocks}>No active locks</span>
                )}
              </div>
            </>
          ) : (
            <div className={styles.noAuth}>
              <div className={styles.noAuthIcon}>
                <svg fill="currentColor" height="28" viewBox="0 0 24 24" width="28" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
              </div>
              <span className={styles.noAuthTitle}>No authorization yet</span>
              <span className={styles.noAuthDesc}>
                A spending authorization is created automatically the first time you pay for a compute job with{' '}
                {token.symbol}.
              </span>
            </div>
          )}
        </div>
      </div>

      {spender && (
        <EditAuthorizationModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            setIsEditOpen(false);
            onChange();
          }}
          spender={spender}
        />
      )}
    </Card>
  );
};

export default EscrowTokenPanel;
