import Card from '@/components/card/card';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import styles from './leaderboard-page.module.css';

const LeaderboardPage = () => {
  return (
    <Container className={styles.root}>
      <SectionTitle title="Leaderboard" subTitle="Explore the most active nodes in the Ocean Network" />
      <div className={styles.content}>
        <JobsRevenueStats />
        <Card padding="md" radius="md" variant="glass-shaded">
          Table
        </Card>
      </div>
    </Container>
  );
};

export default LeaderboardPage;
