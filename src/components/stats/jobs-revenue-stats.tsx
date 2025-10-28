import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { formatNumber } from '@/utils/formatters';
import styles from './jobs-revenue-stats.module.css';

const JobsRevenueStats = () => {
  const { jobsPerEpoch, revenuePerEpoch, totalJobs, totalRevenue } = useStatsContext();

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <div className={styles.revenueWrapper}>
        <h3 className={styles.heading}>Total revenue</h3>
        <div className={styles.revenue}>
          <span className={styles.token}>OCEAN</span>{' '}
          <span className={styles.amount}>{formatNumber(totalRevenue)}</span>
        </div>
      </div>
      <VBarChart
        axisKey="epoch"
        barKey="revenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={revenuePerEpoch}
        title="Revenue per epoch"
      />
      <VBarChart
        axisKey="epoch"
        barKey="jobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={jobsPerEpoch}
        footer={{
          amount: formatNumber(totalJobs),
          label: 'Total jobs',
        }}
        title="Jobs per epoch"
      />
    </Card>
  );
};

export default JobsRevenueStats;
