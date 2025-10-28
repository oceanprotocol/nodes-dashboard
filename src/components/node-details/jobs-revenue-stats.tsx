import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
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
