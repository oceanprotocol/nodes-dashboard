import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { formatNumber } from '@/utils/formatters';
import styles from './owner-stats.module.css';

const OwnerStats = () => {
  // TODO create context for this; replace mock data
  const { jobsPerEpoch, revenuePerEpoch, totalJobs, totalRevenue } = useStatsContext();

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <VBarChart
        axisKey="epoch"
        barKey="revenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={revenuePerEpoch}
        title="Revenue per epoch"
        footer={{
          amount: formatNumber(totalRevenue),
          currency: 'OCEAN',
          label: 'Total revenue',
        }}
      />
      <VBarChart
        axisKey="epoch"
        barKey="jobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={jobsPerEpoch}
        title="Jobs per epoch"
        footer={{
          amount: formatNumber(totalJobs),
          label: 'Total jobs',
        }}
      />
      <Gauge label="Active" max={100} min={0} title="Active nodes" value={63} />
    </Card>
  );
};

export default OwnerStats;
