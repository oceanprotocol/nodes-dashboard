import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TabBar from '@/components/tab-bar/tab-bar';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { BASE_CHAIN_ID, CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { EscrowHistoryEntry, EscrowHistoryKind, useEscrowHistory } from '@/lib/use-escrow-history';
import { formatDateTime, formatTokenAmount, formatWalletAddress } from '@/utils/formatters';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import CachedIcon from '@mui/icons-material/Cached';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './escrow-history.module.css';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

const KIND_META: Record<EscrowHistoryKind, { label: string; icon: React.ReactNode; iconClass: string }> = {
  deposit: { label: 'Deposit', icon: <FileUploadOutlinedIcon fontSize="small" />, iconClass: styles.iconCredit },
  withdraw: { label: 'Withdraw', icon: <FileDownloadOutlinedIcon fontSize="small" />, iconClass: styles.iconDebit },
  lock: { label: 'Lock created', icon: <LockOutlinedIcon fontSize="small" />, iconClass: styles.iconLock },
  release: { label: 'Lock released', icon: <LockOpenOutlinedIcon fontSize="small" />, iconClass: styles.iconCredit },
  charge: { label: 'Job charge', icon: <BoltIcon fontSize="small" />, iconClass: styles.iconDebit },
  'auth-created': { label: 'Auth. created', icon: <VpnKeyOutlinedIcon fontSize="small" />, iconClass: styles.iconAuth },
  'auth-updated': { label: 'Auth. updated', icon: <EditOutlinedIcon fontSize="small" />, iconClass: styles.iconAuth },
  'auth-revoked': { label: 'Auth. revoked', icon: <BlockOutlinedIcon fontSize="small" />, iconClass: styles.iconDebit },
};

// Authorization changes — amount means a max-locked allowance, not a signed fund movement.
const AUTH_KINDS: EscrowHistoryKind[] = ['auth-created', 'auth-updated', 'auth-revoked'];

const getExplorerUrl = () => {
  if (CHAIN_ID === BASE_CHAIN_ID) return 'https://basescan.org';
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) return 'https://sepolia.etherscan.io';
  return 'https://etherscan.io';
};

const escrowHistoryColumns: GridColDef<EscrowHistoryEntry>[] = [
  {
    field: 'kind',
    headerName: 'Type',
    flex: 1.4,
    minWidth: 170,
    sortable: false,
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => {
      const meta = KIND_META[row.kind];
      return (
        <div className={styles.typeCell}>
          <span className={classNames(styles.typeIcon, meta.iconClass)}>{meta.icon}</span>
          <div className={styles.typeText}>
            <span className={styles.typeLabel}>{meta.label}</span>
            {row.tokenSymbol && <span className={styles.typeToken}>{row.tokenSymbol}</span>}
          </div>
        </div>
      );
    },
  },
  {
    field: 'amount',
    headerName: 'Amount',
    flex: 0.9,
    minWidth: 120,
    align: 'right',
    headerAlign: 'right',
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => {
      const isAuth = AUTH_KINDS.includes(row.kind);
      // Revoke has no meaningful limit; auth amounts are a max allowance, not a signed movement.
      if (row.kind === 'auth-revoked') {
        return <span className={styles.amountEmpty}>—</span>;
      }
      const formatted = formatTokenAmount(Math.abs(row.amount), row.tokenAddress);
      if (isAuth) {
        return <span className={styles.amount}>{formatted}</span>;
      }
      const positive = row.amount >= 0;
      return (
        <span className={classNames(styles.amount, positive ? styles.amountPositive : styles.amountNegative)}>
          {positive ? '+' : '-'}
          {formatted} {row.tokenSymbol}
        </span>
      );
    },
  },
  {
    field: 'detail',
    headerName: 'Details',
    flex: 1.6,
    minWidth: 200,
    sortable: false,
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => (
      <div className={styles.detailCell}>
        <span className={styles.detailPrimary}>{row.detail}</span>
        {row.counterparty && (
          <span className={styles.payeeRow}>
            Consumer:{' '}
            <span className={styles.mono} title={row.counterparty}>
              {formatWalletAddress(row.counterparty)}
            </span>
            <button
              aria-label="Copy payee address"
              className={styles.copyButton}
              onClick={() => copyToClipboard(row.counterparty!)}
              type="button"
            >
              <ContentCopyIcon className={styles.copyIcon} />
            </button>
          </span>
        )}
      </div>
    ),
  },
  {
    field: 'txHash',
    headerName: 'Transaction',
    flex: 1,
    minWidth: 140,
    sortable: false,
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => (
      <a
        className={styles.txLink}
        href={`${getExplorerUrl()}/tx/${row.txHash}`}
        rel="noopener noreferrer"
        target="_blank"
        title={row.txHash}
      >
        {formatWalletAddress(row.txHash)}
      </a>
    ),
  },
  {
    field: 'timestamp',
    headerName: 'Date',
    flex: 1,
    minWidth: 140,
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => (
      <span className={styles.date}>{row.timestamp ? formatDateTime(row.timestamp) : `Block ${row.block}`}</span>
    ),
  },
  {
    field: 'status',
    headerName: 'Status',
    flex: 0.8,
    minWidth: 110,
    align: 'right',
    headerAlign: 'right',
    sortable: false,
    renderCell: ({ row }: GridRenderCellParams<EscrowHistoryEntry>) => (
      <span
        className={classNames('chip', {
          chipSuccess: row.status === 'confirmed',
          chipWarning: row.status === 'pending',
          chipError: row.status === 'failed',
        })}
      >
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </span>
    ),
  },
];

const ALL_FILTER = 'ALL';

const EscrowHistory = () => {
  const { entries, loading, reload } = useEscrowHistory();
  const [tokenFilter, setTokenFilter] = useState<string>(ALL_FILTER);

  // Token filter chips: All + every supported token symbol.
  const tokenSymbols = useMemo(() => Object.keys(getSupportedTokens()), []);

  const filtered = useMemo(
    () => (tokenFilter === ALL_FILTER ? entries : entries.filter((entry) => entry.tokenSymbol === tokenFilter)),
    [entries, tokenFilter]
  );

  const tabs = useMemo(
    () => [
      { key: ALL_FILTER, label: 'All', onClick: () => setTokenFilter(ALL_FILTER) },
      ...tokenSymbols.map((symbol) => ({
        key: symbol,
        label: symbol,
        onClick: () => setTokenFilter(symbol),
      })),
    ],
    [tokenSymbols]
  );

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Escrow history</h3>
        {tokenSymbols.length > 0 && <TabBar activeKey={tokenFilter} size="sm" tabs={tabs} />}
      </div>
      <Table<EscrowHistoryEntry>
        autoHeight
        columns={escrowHistoryColumns}
        data={filtered}
        getRowId={(row) => row.id}
        loading={loading}
        paginationType="none"
        tableType={TableTypeEnum.ESCROW_HISTORY}
      />
      <Button
        className="alignSelfEnd"
        color="accent1"
        contentBefore={<CachedIcon />}
        onClick={reload}
        size="sm"
        variant="transparent"
      >
        Refresh
      </Button>
    </Card>
  );
};

export default EscrowHistory;
