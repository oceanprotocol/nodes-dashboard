import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useStatsContext } from '@/context/stats-context';
import { Node } from '@/types/nodes';

const TopNodes = () => {
  const { topNodesByJobs, topNodesByRevenue } = useStatsContext();

  return (
    <>
      <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
        <h3>Top nodes by revenue</h3>
        <Table<Node>
          autoHeight
          data={topNodesByRevenue}
          paginationType="none"
          tableType={TableTypeEnum.NODES_TOP_REVENUE}
        />
      </Card>
      <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
        <h3>Top nodes by number of jobs</h3>
        <Table<Node> autoHeight data={topNodesByJobs} paginationType="none" tableType={TableTypeEnum.NODES_TOP_JOBS} />
      </Card>
    </>
  );
};

export default TopNodes;
