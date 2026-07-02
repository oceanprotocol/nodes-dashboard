import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import CreateAuthorizationModal from '@/components/escrow/create-authorization-modal';
import EditAuthorizationModal from '@/components/escrow/edit-authorization-modal';
import RevokeAuthorizationModal from '@/components/escrow/revoke-authorization-modal';
import Input from '@/components/input/input';
import Menu from '@/components/menu/menu';
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
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { CircularProgress, Collapse, IconButton, ListItemIcon, MenuItem } from '@mui/material';
import classNames from 'classnames';
import { useRef, useState } from 'react';
import styles from './escrow-token-panel.module.css';

type EscrowTokenPanelProps = {
  token: EscrowTokenInfo;
  spenders: EscrowSpenderInfo[];
  loadingSpenders: boolean;
  onChange: () => void;
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
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setMenuAnchor(null);

  const auth = spender.authorizations;
  const locks = spender.locks ?? [];
  const locksUsed = Number(auth.currentLocks);
  const locksMax = Number(auth.maxLockCounts);
  const locksPct = locksMax > 0 ? Math.min(100, (locksUsed / locksMax) * 100) : 0;

  return (
    <Card direction="column" innerShadow="black" padding="sm" radius="md" spacing="sm" variant="glass">
      {/* Auth header */}
      <div className={styles.authHeader}>
        <div>
          <h4>{spender.nodeFriendlyName ?? (spender.nodeId ? 'Unnamed node' : 'Unknown node')}</h4>
          {spender.nodeId && (
            <div className={styles.copyRow}>
              <strong>Peer ID:</strong>
              <span className={styles.hash}>{formatWalletAddress(spender.nodeId)}</span>
              <CopyButton
                color="accent1"
                contentToCopy={spender.nodeId}
                label=""
                labelCopied=""
                size="sm"
                variant="transparent"
              />
            </div>
          )}
          <div className={styles.copyRow}>
            <strong>ETH Address:</strong>
            <span className={styles.hash}>{formatWalletAddress(spender.spender)}</span>
            <CopyButton
              color="accent1"
              contentToCopy={spender.spender}
              label=""
              labelCopied=""
              size="sm"
              variant="transparent"
            />
          </div>
        </div>
        <IconButton
          aria-label="Authorization actions"
          onClick={() => setMenuAnchor(menuButtonRef.current)}
          ref={menuButtonRef}
          size="small"
          sx={{ color: 'var(--text-secondary)' }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          onClose={closeMenu}
          open={!!menuAnchor}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            disableRipple
            onClick={() => {
              setIsEditOpen(true);
              closeMenu();
            }}
          >
            <ListItemIcon>
              <EditOutlinedIcon fontSize="small" />
            </ListItemIcon>
            Edit
          </MenuItem>
          <MenuItem
            disableRipple
            onClick={() => {
              setIsRevokeOpen(true);
              closeMenu();
            }}
            sx={{ color: 'var(--error-darker)' }}
          >
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" sx={{ color: 'var(--error-darker)' }} />
            </ListItemIcon>
            Revoke
          </MenuItem>
        </Menu>
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
          <span className={styles.statLabel}>Locks used (Active jobs)</span>
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
            <span className={styles.overline}>Active jobs</span>
          </button>
          <Collapse in={locksOpen} timeout="auto" unmountOnExit>
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
          </Collapse>
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

  // Single amount input drives both actions. amount > 0 is the base check; the per-action
  // balance ceiling (wallet for deposit, escrow for withdraw) is validated at click time
  // since it depends on which button was pressed.
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | undefined>();

  const { handleDeposit, isDepositing } = useDepositTokens({
    onSuccess: () => {
      setAmount('');
      onChange();
    },
  });
  const { handleWithdraw, isWithdrawing } = useWithdrawTokens({
    onSuccess: () => {
      setAmount('');
      onChange();
    },
  });

  const onDeposit = () => {
    const value = Number(amount);
    if (!(value > 0)) {
      setError('Invalid amount');
      return;
    }
    if (value > token.walletBalance) {
      setError('Exceeds wallet balance');
      return;
    }
    setError(undefined);
    handleDeposit({ tokenAddress: token.address, amount: value.toString() });
  };

  const onWithdraw = () => {
    const value = Number(amount);
    if (!(value > 0)) {
      setError('Invalid amount');
      return;
    }
    if (value > token.available) {
      setError('Exceeds available funds');
      return;
    }
    setError(undefined);
    handleWithdraw({ tokenAddresses: [token.address], amounts: [value.toString()] });
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.panel}>
        {/* ── Left: balance + move funds ── */}
        <div className={styles.left}>
          <h3>{token.symbol}</h3>

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
              <span className={styles.secondaryLabel}>Locked for running jobs</span>
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
            <Input
              className={styles.fundInput}
              errorText={error}
              label="Move funds"
              name="amount"
              onChange={(e) => {
                setAmount(e.target.value);
                setError(undefined);
              }}
              size="md"
              startAdornment={token.symbol}
              type="number"
              value={amount}
            />
            <div className={styles.fundButtons}>
              <Button
                className={styles.fundButton}
                color="accent1"
                contentBefore={<FileDownloadOutlinedIcon fontSize="small" />}
                disabled={!amount || isDepositing || Number(amount) > token.available}
                loading={isWithdrawing}
                onClick={onWithdraw}
                size="md"
                type="button"
                variant="outlined"
              >
                Withdraw
              </Button>
              <Button
                className={styles.fundButton}
                color="accent1"
                contentBefore={<FileUploadOutlinedIcon fontSize="small" />}
                disabled={!amount || isWithdrawing || Number(amount) > token.walletBalance}
                loading={isDepositing}
                onClick={onDeposit}
                size="md"
                type="button"
                variant="filled"
              >
                Deposit
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right: authorizations & locks (one card per authorized spender) ── */}
        <div className={styles.right}>
          <div className={styles.authSectionHeader}>
            <h3>Authorizations</h3>
            {spenders.length > 0 && (
              <span className="chip chipGlass">
                {spenders.length} {spenders.length === 1 ? 'node' : 'nodes'}
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
