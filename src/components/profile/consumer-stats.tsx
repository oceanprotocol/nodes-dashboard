import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { formatNumber } from '@/utils/formatters';
import styles from './consumer-stats.module.css';

const ConsumerStats = () => {
  // TODO create context for this; replace mock data
  const { jobsPerEpoch, revenuePerEpoch, totalJobs, totalRevenue } = useStatsContext();

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <VBarChart
        axisKey="epoch"
        barKey="revenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={revenuePerEpoch}
        title="Amount paid per epoch"
        footer={{
          amount: formatNumber(totalRevenue),
          currency: 'OCEAN',
          label: 'Total paid',
        }}
      />
      <VBarChart
        axisKey="epoch"
        barKey="jobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={jobsPerEpoch}
        title="Jobs run per epoch"
        footer={{
          amount: formatNumber(totalJobs),
          label: 'Total jobs',
        }}
      />
      <Gauge label="Successful" max={100} min={0} title="Jobs success rate" value={63} valueSuffix="%" />
    </Card>
  );
};

export default ConsumerStats;
