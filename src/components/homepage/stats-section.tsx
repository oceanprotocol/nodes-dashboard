import Button from '@/components/button/button';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import { getRoutes } from '@/config';
import Container from '../container/container';
import styles from './leaderboard.module.css';

const StatsSection: React.FC = () => {
  const routes = getRoutes();

  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <JobsRevenueStats />
        <div className={styles.leaderboardFooter}>
          <Button color="accent2" href={routes.stats.path} size="lg" variant="filled">
            View full stats
          </Button>
        </div>
      </Container>
    </div>
  );
};

export default StatsSection;
