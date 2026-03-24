import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useStatsContext } from '@/context/stats-context';
import { Node } from '@/types/nodes';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const TopNodes = () => {
  const router = useRouter();

  const { topNodesByJobs, topNodesByRevenue, fetchTopNodesByRevenue, fetchTopNodesByJobCount } = useStatsContext();

  useEffect(() => {
    fetchTopNodesByRevenue();
  }, [fetchTopNodesByRevenue]);

  useEffect(() => {
    fetchTopNodesByJobCount();
  }, [fetchTopNodesByJobCount]);

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3>Top nodes by revenue</h3>
        <Table<Node>
          autoHeight
          data={topNodesByRevenue.map((item, idx) => ({ index: idx + 1, ...item }))}
          getRowId={(row) => row.nodeId}
          onRowClick={({ row }) => router.push(`/nodes/${row.nodeId}`)}
          paginationType="none"
          tableType={TableTypeEnum.NODES_TOP_REVENUE}
        />
      </Card>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3>Top nodes by number of jobs</h3>
        <Table<Node>
          autoHeight
          data={topNodesByJobs.map((item, idx) => ({ index: idx + 1, ...item }))}
          getRowId={(row) => row.nodeId}
          onRowClick={({ row }) => router.push(`/nodes/${row.nodeId}`)}
          paginationType="none"
          tableType={TableTypeEnum.NODES_TOP_JOBS}
        />
      </Card>
    </>
  );
};

export default TopNodes;
