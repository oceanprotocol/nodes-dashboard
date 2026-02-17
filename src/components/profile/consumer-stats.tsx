import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useProfileContext } from '@/context/profile-context';
import { formatNumber } from '@/utils/formatters';
import { useEffect } from 'react';
import styles from './consumer-stats.module.css';

const ConsumerStats = () => {
  const {
    totalJobs,
    totalPaidAmount,
    consumerStatsPerEpoch,
    successfullJobs,
    fetchConsumerStats,
    fetchJobsSuccessRate,
  } = useProfileContext();

  useEffect(() => {
    fetchConsumerStats();
  }, [fetchConsumerStats]);

  useEffect(() => {
    fetchJobsSuccessRate();
  }, [fetchJobsSuccessRate]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="totalPaidAmount"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={consumerStatsPerEpoch}
        title="Amount paid per epoch"
        footer={{
          amount: formatNumber(totalPaidAmount),
          currency: 'OCEAN',
          label: 'Total paid',
        }}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalJobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={consumerStatsPerEpoch}
        title="Jobs run per epoch"
        footer={{
          amount: formatNumber(totalJobs),
          label: 'Total jobs',
        }}
      />
      <Gauge
        label="Successful"
        max={100}
        min={0}
        title="Jobs success rate"
        value={totalJobs > 0 ? Number(((successfullJobs / totalJobs) * 100).toFixed(1)) : 0}
        valueSuffix="%"
      />
    </Card>
  );
};

export default ConsumerStats;
