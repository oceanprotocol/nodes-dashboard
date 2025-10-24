import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
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
        <VBarChart
          axisKey="epoch"
          barKey="revenue"
          chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
          data={revenuePerEpoch}
        />
      </div>
      <div className={styles.chartWrapper}>
        <h3 className={styles.heading}>Jobs per epoch</h3>
        <VBarChart axisKey="epoch" barKey="jobs" chartType={ChartTypeEnum.JOBS_PER_EPOCH} data={jobsPerEpoch} />
        <div className={styles.totalJobs}>
          <div className={styles.label}>Total jobs</div>
          <div className={styles.amount}>{formatNumber(totalJobs)}</div>
        </div>
      </div>
    </Card>
  );
};

export default JobsRevenueStats;
