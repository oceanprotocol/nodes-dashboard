import Card from '@/components/card/card';
import BarChart from '@/components/chart/bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { formatNumber } from '@/utils/formatters';
import styles from './jobs-revenue-stats.module.css';

const JobsRevenueStats = () => {
  const { jobsPerEpoch, revenuePerEpoch, totalJobs, totalRevenue } = useStatsContext();

  return (
    <Card className={styles.root} paddingX="lg" paddingY="sm" radius="md" variant="glass-shaded">
      <div className={styles.chartWrapper}>
        <h3 className={styles.heading}>Total revenue</h3>
        <div className={styles.revenue}>
          <span className={styles.token}>OCEAN</span>{' '}
          <span className={styles.amount}>{formatNumber(totalRevenue)}</span>
        </div>
      </div>
      <div className={styles.chartWrapper}>
        <h3 className={styles.heading}>Revenue per epoch</h3>
        <BarChart axisKey="epoch" barKey="revenue" data={revenuePerEpoch} />
      </div>
      <div className={styles.chartWrapper}>
        <h3 className={styles.heading}>Jobs per epoch</h3>
        <BarChart axisKey="epoch" barKey="jobs" data={jobsPerEpoch} />
        <div className={styles.totalJobs}>
          <div className={styles.label}>Total jobs</div>
          <div className={styles.amount}>{formatNumber(totalJobs)}</div>
        </div>
      </div>
    </Card>
  );
};

export default JobsRevenueStats;
