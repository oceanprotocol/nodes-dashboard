import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { formatNumber } from '@/utils/formatters';
import styles from './jobs-revenue-stats.module.css';

type ChartWrapperProps = {
  title: string;
  children: React.ReactNode;
  footer?: {
    amount: string;
    currency?: string;
    label: string;
  };
};

const JobsRevenueStats = () => {
  const { jobsPerEpoch, revenuePerEpoch, totalJobs, totalRevenue } = useStatsContext();

  return (
    <Card className={styles.root} paddingX="lg" paddingY="sm" radius="md" variant="glass-shaded">
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
      <Gauge label="Latest" max={5415} min={100} title="Benchmark results" value={3000} />
      <Gauge label="Running" max={100} min={0} title="Queued jobs" value={63} />
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
    </Card>
  );
};

export default JobsRevenueStats;
