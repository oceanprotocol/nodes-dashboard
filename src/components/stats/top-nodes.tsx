import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useStatsContext } from '@/context/stats-context';
import { Node } from '@/types/nodes';
import { useEffect } from 'react';

const TopNodes = () => {
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
          paginationType="none"
          tableType={TableTypeEnum.NODES_TOP_REVENUE}
          getRowId={(row) => row.nodeId}
        />
      </Card>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <h3>Top nodes by number of jobs</h3>
        <Table<Node>
          autoHeight
          data={topNodesByJobs.map((item, idx) => ({ index: idx + 1, ...item }))}
          paginationType="none"
          tableType={TableTypeEnum.NODES_TOP_JOBS}
          getRowId={(row) => row.nodeId}
        />
      </Card>
    </>
  );
};

export default TopNodes;
