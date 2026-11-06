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
  NodeCell,
  nodeColumn,
} from '@/components/escrow/history-cells';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import CustomPagination from '@/components/table/custom-pagination';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { formatEscrowJobId } from '@/lib/escrow-events';
import { SubsidyHistoryEntry } from '@/lib/subsidy';
import { useNodesByWallets } from '@/lib/use-escrow-events';
import { useSubsidyHistory, useSubsidyProgram } from '@/lib/use-subsidy';
import { GridColDef } from '@mui/x-data-grid';
import { useMemo } from 'react';
import styles from './subsidy-section.module.css';

const SubsidyHistory = () => {
  const { data: program } = useSubsidyProgram();
  const { data: history, isError, isLoading } = useSubsidyHistory();
  const entries = useMemo(() => history ?? [], [history]);
  const nodeWallets = useMemo(() => entries.map((entry) => entry.node), [entries]);
  const { data: nodesByWallet } = useNodesByWallets(nodeWallets);
  const { changePageSize, hasPagination, page, pageItems, pageSize, setPage } = useClientPagination(entries);

  const columns = useMemo<GridColDef<SubsidyHistoryEntry>[]>(() => {
    const describe = (entry: SubsidyHistoryEntry) =>
      [
        entry.oneTime > 0 ? 'On us' : null,
        entry.discount > 0 && program?.discount ? `${formatSubsidyAmount(program.discount.percent)}% discount` : null,
        entry.custom > 0 ? 'Other subsidy' : null,
      ]
        .filter(Boolean)
        .join(' + ');

    return [
      dateColumn(({ row }) => <DateCell timestamp={row.date ? row.date.getTime() / 1000 : null} />),
      jobKindColumn(({ row }) =>
        !row.job && row.status === 'locked' ? (
          <span className="chip chipWarning">Running</span>
        ) : (
          <JobKindCell kind={row.job?.kind ?? null} />
        )
      ),
      amountColumn('subsidized', 'Subsidized', ({ row }) => (
        <AmountCell amount={`+${formatSubsidyTokenAmount(row.total)}`} note={describe(row)} tone="positive" />
      )),
      amountColumn('paid', 'You paid', ({ row }) => <AmountCell amount={formatSubsidyTokenAmount(row.paid)} />),
      amountColumn('cost', 'Cost', ({ row }) => (
        <AmountCell
          amount={formatSubsidyTokenAmount(row.cost)}
          note={row.status === 'locked' ? 'max, still running' : undefined}
        />
      )),
      jobIdColumn(({ row }) => <JobIdCell id={row.job?.id ?? formatEscrowJobId(row.jobId)} />),
      nodeColumn(({ row }) => <NodeCell nodesByWallet={nodesByWallet} wallet={row.node} />),
    ];
  }, [nodesByWallet, program?.discount]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.historyHeader}>
        <h4 className={styles.historyTitle}>Subsidy history</h4>
        <Button color="accent2" href="/account/escrow/history" size="md" variant="filled">
          View escrow history
        </Button>
      </div>
      {isError ? <span className={styles.small}>Couldn&apos;t load your subsidy history. Try again later.</span> : null}
      <Table<SubsidyHistoryEntry>
        autoHeight
        columns={columns}
        data={pageItems}
        getRowId={(row) => row.id}
        loading={isLoading}
        paginationType="none"
        tableType={TableTypeEnum.SUBSIDY_HISTORY}
      />
      {hasPagination ? (
        <CustomPagination
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          page={page}
          pageSize={pageSize}
          totalItems={entries.length}
        />
      ) : null}
    </Card>
  );
};

export default SubsidyHistory;
