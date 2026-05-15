'use client';

import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { NodeToken } from '@/types/node-tokens';
import { formatDateTime } from '@/utils/formatters';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import classNames from 'classnames';
import styles from './node-tokens.module.css';

type NodeTokensProps = {
  nodeId: string;
  tokens: NodeToken[];
  onRemove: (token: NodeToken) => void;
};

const columns: GridColDef<NodeToken>[] = [
  {
    field: 'token',
    headerName: 'Key',
    flex: 1,
    minWidth: 180,
    sortable: false,
    renderCell: ({ row }) => <span className={styles.tokenValue}>{row.token.slice(0, 24)}…</span>,
  },
  {
    field: 'active',
    headerName: 'Status',
    width: 110,
    sortable: false,
    renderCell: ({ row }) => {
      const expired = !!row.expiryTimestamp && row.expiryTimestamp < Date.now();
      return (
        <span className={classNames('chip', expired ? 'chipError' : 'chipSuccess')} style={{ alignSelf: 'center' }}>
          {expired ? 'Expired' : 'Active'}
        </span>
      );
    },
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 180,
    sortable: false,
    renderCell: ({ row }) => formatDateTime(row.createdAt / 1000),
  },
  {
    field: 'expiryTimestamp',
    headerName: 'Expiration date',
    width: 180,
    sortable: false,
    renderCell: ({ row }) => (row.expiryTimestamp ? formatDateTime(row.expiryTimestamp / 1000) : 'No expiration'),
  },
];

const NodeTokens: React.FC<NodeTokensProps> = ({ tokens, onRemove }) => {
  if (tokens?.length === 0) {
    return <span className={styles.empty}>No tokens generated for this node yet.</span>;
  }

  return (
    <Table
      autoHeight
      initialDensity="compact"
      actionsColumn={(params: GridRenderCellParams<NodeToken>) => (
        <>
          <CopyButton color="accent1" contentToCopy={params.row.token} size="sm" variant="transparent" />
          <Button
            color="accent1"
            contentBefore={<DeleteOutlineIcon />}
            onClick={() => onRemove(params.row)}
            size="sm"
            variant="transparent"
          >
            Revoke
          </Button>
        </>
      )}
      columns={columns}
      data={tokens}
      getRowId={(row) => row.token}
      paginationType="none"
      tableType={TableTypeEnum.MY_JOBS}
    />
  );
};

export default NodeTokens;
