import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import {
  NodeHistoryKind,
  NodeHistoryTableProvider,
  useNodeHistoryTableContext,
} from '@/context/table/node-history-table-context';
import { Node } from '@/types';
import { NodeJobHistory, NodeServiceHistory } from '@/types/jobs';
import { formatError } from '@/utils/formatters';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import styles from './node-running-workloads.module.css';

const COPY = {
  jobs: {
    title: 'Compute jobs history',
    subtitle: 'Every compute job this node has run, across all consumers',
    tableType: TableTypeEnum.NODE_JOBS_HISTORY,
  },
  services: {
    title: 'Services history',
    subtitle: 'Every service this node has run, across all consumers',
    tableType: TableTypeEnum.NODE_SERVICES_HISTORY,
  },
} as const;

const NodeWorkloadHistoryContent = ({ kind }: { kind: NodeHistoryKind }) => {
  const ctx = useNodeHistoryTableContext<NodeJobHistory | NodeServiceHistory>();
  const { authError, authorize, error, fetchData, loading, needsAuth } = ctx;
  const copy = COPY[kind];

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.head}>
        <div className={styles.title}>
          <h3>{copy.title}</h3>
          <span className="textSecondary">
            {needsAuth ? `${copy.subtitle}. Sign once with your admin wallet to load it.` : copy.subtitle}
          </span>
        </div>
        <Button
          color="accent2"
          disabled={loading}
          loading={loading}
          onClick={needsAuth ? authorize : fetchData}
          size="md"
          variant="filled"
        >
          {needsAuth ? 'Load history' : 'Refresh'}
        </Button>
      </div>

      {authError ? (
        <p className="textErrorDarker flexRow alignItemsCenter gapXs">
          <span className="textBold">This wallet is not recognised as an admin of this node</span>
          <Tooltip title={authError}>
            <InfoOutlinedIcon fontSize="small" />
          </Tooltip>
        </p>
      ) : error ? (
        <p className="textErrorDarker flexRow alignItemsCenter gapXs">
          <span className="textBold">Failed to load history</span>
          <Tooltip title={formatError({ error })}>
            <InfoOutlinedIcon fontSize="small" />
          </Tooltip>
        </p>
      ) : null}

      {needsAuth ? null : (
        <Table<NodeJobHistory | NodeServiceHistory>
          context={ctx}
          paginationType="context"
          showToolbar
          tableType={copy.tableType}
        />
      )}
    </Card>
  );
};

type NodeWorkloadHistoryProps = {
  node: Node;
  kind: NodeHistoryKind;
};

// Full job/service history of a node, for its admins. The running cards stay the live view; this
// is served by the incentive-backend (the node itself purges finished jobs after a few days) and
// needs one admin signature, shared by both history tables. The page renders it owner-only.
const NodeWorkloadHistory = ({ node, kind }: NodeWorkloadHistoryProps) => {
  const nodeId = node.id ?? node.nodeId;

  if (!nodeId) {
    return null;
  }

  return (
    <NodeHistoryTableProvider kind={kind} nodeId={nodeId}>
      <NodeWorkloadHistoryContent kind={kind} />
    </NodeHistoryTableProvider>
  );
};

export default NodeWorkloadHistory;
