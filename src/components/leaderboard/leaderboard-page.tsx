import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useLeaderboardTableContext } from '@/context/table/leaderboard-table-context';
import { AnyNode } from '@/types/nodes';

const LeaderboardPage = () => {
  const leaderboardTableContext = useLeaderboardTableContext();

  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Leaderboard" subTitle="Explore the most active nodes in the Ocean Network" />
      <div className="pageContentWrapper">
        <JobsRevenueStats />
        <Card padding="md" radius="lg" shadow="black" variant="glass-shaded">
          <Table<AnyNode>
            context={leaderboardTableContext}
            paginationType="context"
            showToolbar
            tableType={TableTypeEnum.NODES_LEADERBOARD}
          />
        </Card>
      </div>
    </Container>
  );
};

export default LeaderboardPage;
