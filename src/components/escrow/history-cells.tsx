import CopyButton from '@/components/button/copy-button';
import { EscrowJobKind } from '@/lib/escrow-events';
import { formatDateTime, formatWalletAddress } from '@/utils/formatters';
import { GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import classNames from 'classnames';
import Link from 'next/link';
import { ReactNode } from 'react';
import styles from './history-cells.module.css';

export type NodesByWallet = Map<string, { friendlyName?: string; id: string }>;

const JOB_KIND_LABELS: Record<EscrowJobKind, string> = {
  compute: 'Compute',
  service: 'Inference',
};

const formatJobId = (jobId: string) => (jobId.length > 12 ? `${jobId.slice(0, 4)}…${jobId.slice(-4)}` : jobId);

export const MissingCell = () => <span className={styles.muted}>—</span>;

export const DateCell = ({ fallback, timestamp }: { fallback?: string; timestamp: number | null }) =>
  timestamp ? (
    <span className={styles.muted}>{formatDateTime(timestamp)}</span>
  ) : fallback ? (
    <span className={styles.muted}>{fallback}</span>
  ) : (
    <MissingCell />
  );

export const JobKindCell = ({ kind }: { kind: EscrowJobKind | null }) =>
  kind ? <span className="chip chipGlass">{JOB_KIND_LABELS[kind]}</span> : <MissingCell />;

export const JobIdCell = ({ id }: { id: string | null }) =>
  id ? (
    <span className="flexRow alignItemsCenter gapXs" title={id}>
      <span className={styles.mono}>{formatJobId(id)}</span>
      <CopyButton
        aria-label={`Copy job ID ${id}`}
        color="accent1"
        contentToCopy={id}
        label=""
        labelCopied=""
        size="xs"
        variant="transparent"
      />
    </span>
  ) : (
    <MissingCell />
  );

export const NodeCell = ({ nodesByWallet, wallet }: { nodesByWallet?: NodesByWallet; wallet: string | null }) => {
  if (!wallet) {
    return <MissingCell />;
  }
  const node = nodesByWallet?.get(wallet.toLowerCase());
  if (!node) {
    return (
      <span className={styles.mono} title={wallet}>
        {formatWalletAddress(wallet)}
      </span>
    );
  }
  return (
    <Link
      className={classNames(styles.link, styles.mono)}
      href={`/nodes/${node.id}`}
      title={node.friendlyName ?? node.id}
    >
      {formatWalletAddress(node.id)}
    </Link>
  );
};

export const AmountCell = ({
  amount,
  note,
  tone,
}: {
  amount: ReactNode;
  note?: ReactNode;
  tone?: 'positive' | 'negative';
}) => (
  <div className={classNames(styles.stack, styles.stackEnd)}>
    <span
      className={classNames(styles.amount, {
        [styles.amountPositive]: tone === 'positive',
        [styles.amountNegative]: tone === 'negative',
      })}
    >
      {amount}
    </span>
    {note ? <span className={styles.secondary}>{note}</span> : null}
  </div>
);

type CellRenderer<T extends GridValidRowModel> = GridColDef<T>['renderCell'];

export const dateColumn = <T extends GridValidRowModel>(renderCell: CellRenderer<T>): GridColDef<T> => ({
  field: 'date',
  headerName: 'Date',
  flex: 0.9,
  minWidth: 140,
  sortable: false,
  renderCell,
});

export const jobKindColumn = <T extends GridValidRowModel>(renderCell: CellRenderer<T>): GridColDef<T> => ({
  field: 'jobKind',
  headerName: 'Job type',
  flex: 0.8,
  minWidth: 130,
  sortable: false,
  renderCell,
});

export const jobIdColumn = <T extends GridValidRowModel>(renderCell: CellRenderer<T>): GridColDef<T> => ({
  field: 'jobId',
  headerName: 'Job / service ID',
  flex: 1,
  minWidth: 160,
  sortable: false,
  renderCell,
});

export const nodeColumn = <T extends GridValidRowModel>(renderCell: CellRenderer<T>): GridColDef<T> => ({
  field: 'node',
  headerName: 'Node',
  flex: 0.9,
  minWidth: 140,
  sortable: false,
  renderCell,
});

export const amountColumn = <T extends GridValidRowModel>(
  field: string,
  headerName: string,
  renderCell: CellRenderer<T>
): GridColDef<T> => ({
  field,
  headerName,
  flex: 0.9,
  minWidth: 140,
  align: 'right',
  headerAlign: 'right',
  sortable: false,
  renderCell,
});
