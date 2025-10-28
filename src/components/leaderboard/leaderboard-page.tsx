import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useLeaderboardTableContext } from '@/context/table/leaderboard-table-context';
import styles from './leaderboard-page.module.css';

const LeaderboardPage = () => {
  const leaderboardTableContext = useLeaderboardTableContext();

  return (
    <Container className={styles.root}>
      <SectionTitle title="Leaderboard" subTitle="Explore the most active nodes in the Ocean Network" />
      <div className={styles.content}>
        <JobsRevenueStats />
        <Card padding="md" radius="lg" variant="glass-shaded">
          <Table<Node>
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
