import Button from '@/components/button/button';
import Card from '@/components/card/card';
import {
  AmountCell,
  amountColumn,
  DateCell,
  dateColumn,
  JobIdCell,
  jobIdColumn,
  JobKindCell,
  jobKindColumn,
  MissingCell,
  NodeCell,
  nodeColumn,
} from '@/components/escrow/history-cells';
import TabBar from '@/components/tab-bar/tab-bar';
import CustomPagination from '@/components/table/custom-pagination';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getExplorerUrl } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { useNodesByWallets } from '@/lib/use-escrow-events';
import { EscrowHistoryEntry, EscrowHistoryKind, useEscrowHistory } from '@/lib/use-escrow-history';
import { formatTokenAmount, formatWalletAddress } from '@/utils/formatters';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BoltIcon from '@mui/icons-material/Bolt';
import CachedIcon from '@mui/icons-material/Cached';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockResetIcon from '@mui/icons-material/LockReset';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { GridColDef } from '@mui/x-data-grid';
import classNames from 'classnames';
import { ReactNode, useMemo, useState } from 'react';
import styles from './escrow-history.module.css';

const KIND_META: Record<EscrowHistoryKind, { icon: ReactNode; iconClass: string; label: string }> = {
  deposit: { icon: <FileUploadOutlinedIcon fontSize="small" />, iconClass: styles.iconCredit, label: 'Deposit' },
  withdraw: { icon: <FileDownloadOutlinedIcon fontSize="small" />, iconClass: styles.iconDebit, label: 'Withdraw' },
  'auth-created': {
    icon: <VpnKeyOutlinedIcon fontSize="small" />,
    iconClass: styles.iconNeutral,
    label: 'Authorization created',
  },
  'auth-updated': {
    icon: <EditOutlinedIcon fontSize="small" />,
    iconClass: styles.iconNeutral,
    label: 'Authorization updated',
  },
  'auth-revoked': {
    icon: <BlockOutlinedIcon fontSize="small" />,
    iconClass: styles.iconDebit,
    label: 'Authorization revoked',
  },
  lock: { icon: <LockOutlinedIcon fontSize="small" />, iconClass: styles.iconLock, label: 'Lock created' },
  relock: { icon: <LockResetIcon fontSize="small" />, iconClass: styles.iconLock, label: 'Lock updated' },
  claim: { icon: <BoltIcon fontSize="small" />, iconClass: styles.iconDebit, label: 'Job charge' },
  cancel: { icon: <LockOpenOutlinedIcon fontSize="small" />, iconClass: styles.iconCredit, label: 'Lock released' },
  'subsidy-lock': {
    icon: <RedeemOutlinedIcon fontSize="small" />,
    iconClass: styles.iconCredit,
    label: 'Subsidy applied',
  },
  'subsidy-refund': { icon: <UndoIcon fontSize="small" />, iconClass: styles.iconNeutral, label: 'Subsidy returned' },
  'subsidy-claim': {
    icon: <RedeemOutlinedIcon fontSize="small" />,
    iconClass: styles.iconCredit,
    label: 'Subsidy credited',
  },
};

const AUTH_KINDS: EscrowHistoryKind[] = ['auth-created', 'auth-updated', 'auth-revoked'];

const ALL_FILTER = 'ALL';

const renderAmount = (entry: EscrowHistoryEntry) => {
  if (entry.amount === null) {
    return <MissingCell />;
  }
  const formatted = `${formatTokenAmount(entry.amount, entry.token?.address ?? '')}${entry.token ? ` ${entry.token.symbol}` : ''}`;
  if (AUTH_KINDS.includes(entry.kind)) {
    return <AmountCell amount={`max ${formatted}`} />;
  }
  const sign = entry.direction === 'in' ? '+' : entry.direction === 'out' ? '-' : '';
  const tone = entry.direction === 'in' ? 'positive' : entry.direction === 'out' ? 'negative' : undefined;
  return <AmountCell amount={`${sign}${formatted}`} tone={tone} />;
};

const EscrowHistory = () => {
  const { entries, isError, isFetching, refetch } = useEscrowHistory();
  const [tokenFilter, setTokenFilter] = useState<string>(ALL_FILTER);

  const payees = useMemo(() => entries.flatMap((entry) => (entry.payee ? [entry.payee] : [])), [entries]);
  const { data: nodesByWallet } = useNodesByWallets(payees);

  const tokenSymbols = useMemo(() => Object.keys(getSupportedTokens()), []);

  const filtered = useMemo(
    () => (tokenFilter === ALL_FILTER ? entries : entries.filter((entry) => entry.token?.symbol === tokenFilter)),
    [entries, tokenFilter]
  );
  const { changePageSize, hasPagination, page, pageItems, pageSize, resetPage, setPage } =
    useClientPagination(filtered);

  const selectToken = (symbol: string) => {
    setTokenFilter(symbol);
    resetPage();
  };

  const columns = useMemo<GridColDef<EscrowHistoryEntry>[]>(
    () => [
      dateColumn(({ row }) => <DateCell fallback={`Block ${row.block}`} timestamp={row.timestamp} />),
      {
        field: 'kind',
        headerName: 'Type',
        flex: 1.3,
        minWidth: 220,
        sortable: false,
        renderCell: ({ row }) => {
          const meta = KIND_META[row.kind];
          return (
            <div className={styles.typeCell}>
              <span className={classNames(styles.typeIcon, meta.iconClass)}>{meta.icon}</span>
              <div className={styles.typeText}>
                <span className={styles.typeLabel}>{meta.label}</span>
                {row.token ? <span className={styles.typeToken}>{row.token.symbol}</span> : null}
              </div>
            </div>
          );
        },
      },
      amountColumn('amount', 'Amount', ({ row }) => renderAmount(row)),
      {
        field: 'detail',
        headerName: 'Details',
        flex: 1.2,
        minWidth: 200,
        sortable: false,
      },
      jobKindColumn(({ row }) => <JobKindCell kind={row.job?.kind ?? null} />),
      jobIdColumn(({ row }) => <JobIdCell id={row.job?.id ?? null} />),
      nodeColumn(({ row }) => (
        <NodeCell
          nodesByWallet={nodesByWallet}
          wallet={row.kind === 'deposit' || row.kind === 'withdraw' ? null : row.payee}
        />
      )),
      {
        field: 'txHash',
        headerName: 'Transaction',
        flex: 0.9,
        minWidth: 140,
        sortable: false,
        renderCell: ({ row }) => (
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
    ],
    [nodesByWallet]
  );

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h4>Escrow history</h4>
        <TabBar
          activeKey={tokenFilter}
          size="sm"
          tabs={[
            { key: ALL_FILTER, label: 'All', onClick: () => selectToken(ALL_FILTER) },
            ...tokenSymbols.map((symbol) => ({ key: symbol, label: symbol, onClick: () => selectToken(symbol) })),
          ]}
        />
      </div>
      {isError ? <span className={styles.hint}>Couldn&apos;t load your escrow history. Try again later.</span> : null}
      <Table<EscrowHistoryEntry>
        autoHeight
        columns={columns}
        data={pageItems}
        getRowId={(row) => row.id}
        loading={isFetching}
        paginationType="none"
        tableType={TableTypeEnum.ESCROW_HISTORY}
      />
      {hasPagination ? (
        <CustomPagination
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
        />
      ) : null}
      <Button
        className="alignSelfEnd"
        color="accent1"
        contentBefore={<CachedIcon />}
        disabled={isFetching}
        onClick={() => refetch()}
        size="sm"
        variant="transparent"
      >
        Refresh
      </Button>
    </Card>
  );
};

export default EscrowHistory;
