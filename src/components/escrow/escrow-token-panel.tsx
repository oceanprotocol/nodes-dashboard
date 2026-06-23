import Button from '@/components/button/button';
import Card from '@/components/card/card';
import CreateAuthorizationModal from '@/components/escrow/create-authorization-modal';
import EditAuthorizationModal from '@/components/escrow/edit-authorization-modal';
import RevokeAuthorizationModal from '@/components/escrow/revoke-authorization-modal';
import Input from '@/components/input/input';
import { useDepositTokens } from '@/lib/use-deposit-tokens';
import { EscrowSpenderInfo, EscrowTokenInfo } from '@/lib/use-escrow-data';
import { useWithdrawTokens } from '@/lib/use-withdraw-tokens';
import { formatDateTime, formatDuration, formatTokenAmount, formatWalletAddress } from '@/utils/formatters';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { useFormik } from 'formik';
import { useState } from 'react';
import * as Yup from 'yup';
import styles from './escrow-token-panel.module.css';

type EscrowTokenPanelProps = {
  token: EscrowTokenInfo;
  spenders: EscrowSpenderInfo[];
  loadingSpenders: boolean;
  onChange: () => void;
};

type AmountFormValues = {
  amount: number | '';
};

// One spending-authorization card (right-hand side). A token can have multiple authorized
// spenders, so each gets its own card with its own edit + locks-expansion state.
const AuthorizationCard = ({
  spender,
  token,
  onChange,
}: {
  spender: EscrowSpenderInfo;
  token: EscrowTokenInfo;
  onChange: () => void;
}) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [locksOpen, setLocksOpen] = useState(false);

  const auth = spender.authorizations;
  const locks = spender.locks ?? [];
  const locksUsed = Number(auth.currentLocks);
  const locksMax = Number(auth.maxLockCounts);
  const locksPct = locksMax > 0 ? Math.min(100, (locksUsed / locksMax) * 100) : 0;

  return (
    <Card direction="column" innerShadow="black" padding="sm" radius="md" spacing="sm" variant="glass">
      {/* Auth header */}
      <div className={styles.authHeader}>
        <div className={styles.authSpender} title={spender.spender}>
          Consumer {formatWalletAddress(spender.spender)}
        </div>
        <div className={styles.authActions}>
          <Button
            color="accent1"
            contentBefore={<EditOutlinedIcon fontSize="small" />}
            onClick={() => setIsEditOpen(true)}
            size="sm"
            variant="outlined"
          >
            Edit
          </Button>
          <Button
            color="accent1"
            contentBefore={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => setIsRevokeOpen(true)}
            size="sm"
            variant="filled"
          >
            Revoke
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Max locked</span>
          <span className={styles.statValue}>
            {formatTokenAmount(Number(auth.maxLockedAmount), token.address)} {token.symbol}
          </span>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Locked now</span>
          <span className={styles.statValue}>
            {formatTokenAmount(Number(auth.currentLockedAmount), token.address)} {token.symbol}
          </span>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Max duration</span>
          <span className={styles.statValue}>{formatDuration(Number(auth.maxLockSeconds), true)}</span>
        </div>
        <div className={styles.statField}>
          <span className={styles.statLabel}>Locks used</span>
          <div className={styles.locksUsedRow}>
            <span className={styles.statValue}>
              {locksUsed} / {locksMax}
            </span>
            <div className={styles.locksBar}>
              <div className={styles.locksBarFill} style={{ width: `${locksPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Active locks (collapsible) */}
      {locks.length ? (
        <div className={styles.locksSection}>
          <button
            aria-expanded={locksOpen}
            className={styles.locksHeader}
            disabled={locks.length === 0}
            onClick={() => setLocksOpen((open) => !open)}
            type="button"
          >
            <ChevronRightIcon className={locksOpen ? styles.chevronOpen : styles.chevron} fontSize="small" />
            <span className={styles.overline}>Active Locks</span>
          </button>
          {locksOpen && locks.length > 0 && (
            <div className={styles.locksTable}>
              <div className={styles.locksTableHeader}>
                <span>Job</span>
                <span className={styles.centerCol}>Amount</span>
                <span className={classNames(styles.rightCol, styles.lockExpiry)}>Expires</span>
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
          )}
        </div>
      ) : (
        <span className={styles.noLocks}>No active locks</span>
      )}

      <EditAuthorizationModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          setIsEditOpen(false);
          onChange();
        }}
        spender={spender}
      />

      <RevokeAuthorizationModal
        isOpen={isRevokeOpen}
        onClose={() => setIsRevokeOpen(false)}
        onSuccess={() => {
          setIsRevokeOpen(false);
          onChange();
        }}
        spender={spender}
      />
    </Card>
  );
};

const EscrowTokenPanel = ({ token, spenders, loadingSpenders, onChange }: EscrowTokenPanelProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { handleDeposit, isDepositing } = useDepositTokens({
    onSuccess: () => {
      depositForm.resetForm();
      onChange();
    },
  });
  const { handleWithdraw, isWithdrawing } = useWithdrawTokens({
    onSuccess: () => {
      withdrawForm.resetForm();
      onChange();
    },
  });

  const depositForm = useFormik<AmountFormValues>({
    initialValues: { amount: '' },
    onSubmit: (values) => handleDeposit({ tokenAddress: token.address, amount: values.amount.toString() }),
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number().moreThan(0, 'Invalid amount').max(token.walletBalance, 'Exceeds wallet balance'),
    }),
  });

  const withdrawForm = useFormik<AmountFormValues>({
    initialValues: { amount: '' },
    onSubmit: (values) => handleWithdraw({ tokenAddresses: [token.address], amounts: [values.amount.toString()] }),
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number().moreThan(0, 'Invalid amount').max(token.available, 'Exceeds available funds'),
    }),
  });

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
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
                className={styles.fundInput}
                endAdornment={
                  <Button
                    className={styles.fundButton}
                    color="accent1"
                    contentBefore={<FileUploadOutlinedIcon fontSize="small" />}
                    disabled={!depositForm.isValid || !depositForm.values.amount}
                    loading={isDepositing}
                    size="sm"
                    type="submit"
                    variant="filled"
                  >
                    Deposit
                  </Button>
                }
                errorText={
                  depositForm.touched.amount && depositForm.errors.amount ? depositForm.errors.amount : undefined
                }
                name="amount"
                onBlur={depositForm.handleBlur}
                onChange={depositForm.handleChange}
                size="md"
                startAdornment={token.symbol}
                type="number"
                value={depositForm.values.amount}
              />
            </form>
            <form className={styles.fundRow} onSubmit={withdrawForm.handleSubmit}>
              <Input
                className={styles.fundInput}
                endAdornment={
                  <Button
                    className={styles.fundButton}
                    color="accent1"
                    contentBefore={<FileDownloadOutlinedIcon fontSize="small" />}
                    disabled={!withdrawForm.isValid || !withdrawForm.values.amount}
                    loading={isWithdrawing}
                    size="sm"
                    type="submit"
                    variant="outlined"
                  >
                    Withdraw
                  </Button>
                }
                errorText={
                  withdrawForm.touched.amount && withdrawForm.errors.amount ? withdrawForm.errors.amount : undefined
                }
                name="amount"
                onBlur={withdrawForm.handleBlur}
                onChange={withdrawForm.handleChange}
                size="md"
                startAdornment={token.symbol}
                type="number"
                value={withdrawForm.values.amount}
              />
            </form>
          </div>
        </div>

        {/* ── Right: authorizations & locks (one card per authorized spender) ── */}
        <div className={styles.right}>
          <div className={styles.authSectionHeader}>
            <span className={styles.authSectionTitle}>Authorizations</span>
            {spenders.length > 0 && (
              <span className="chip chipGlass">
                {spenders.length} {spenders.length === 1 ? 'consumer' : 'consumers'}
              </span>
            )}
            <Button
              className={styles.createAuthButton}
              color="accent2"
              contentBefore={<AddIcon fontSize="small" />}
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              variant="filled"
            >
              Create
            </Button>
          </div>
          {loadingSpenders && spenders.length === 0 ? (
            <div className={styles.authLoading}>
              <CircularProgress size={28} />
            </div>
          ) : spenders.length > 0 ? (
            spenders.map((spender) => (
              <AuthorizationCard key={spender.spender} onChange={onChange} spender={spender} token={token} />
            ))
          ) : (
            <div className={styles.noAuth}>
              <div className={styles.noAuthIcon}>
                <LockOutlinedIcon sx={{ fontSize: 28 }} />
              </div>
              <span className={styles.noAuthTitle}>No authorization yet</span>
              <span className={styles.noAuthDesc}>
                An authorization is created automatically the first time you pay for a compute job with {token.symbol}.
              </span>
            </div>
          )}
        </div>
      </div>

      <CreateAuthorizationModal
        existingConsumers={spenders.map((s) => s.spender)}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          onChange();
        }}
        tokenAddress={token.address}
        tokenSymbol={token.symbol}
      />
    </Card>
  );
};

export default EscrowTokenPanel;
