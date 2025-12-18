import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { formatNumber } from '@/utils/formatters';
import styles from './owner-stats.module.css';
import { useProfileContext } from '@/context/profile-context';
import { useEffect } from 'react';

const OwnerStats = () => {
  const { totalNetworkRevenue, totalBenchmarkRevenue, totalNetworkJobs, totalBenchmarkJobs, ownerStatsPerEpoch, activeNodes, totalNodes, fetchOwnerStats, fetchActiveNodes } = useProfileContext();

  useEffect(() => {
    fetchActiveNodes();
  }, [fetchActiveNodes]);

  useEffect(() => {
    fetchOwnerStats();
  }, [fetchOwnerStats]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="totalRevenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={ownerStatsPerEpoch}
        title="Revenue per epoch"
        footer={{
          amount: formatNumber(totalNetworkRevenue + totalBenchmarkRevenue),
          currency: 'OCEAN',
          label: 'Total revenue',
        }}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalJobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={ownerStatsPerEpoch}
        title="Jobs per epoch"
        footer={{
          amount: formatNumber(totalNetworkJobs + totalBenchmarkJobs),
          label: 'Total jobs',
        }}
      />
      <Gauge
        label="Active"
        max={100}
        min={0}
        title="Active nodes"
        value={totalNodes > 0 ? Number(((activeNodes / totalNodes) * 100).toFixed(1)) : 0}
        valueSuffix="%"
      />
    </Card>
  );
};

export default OwnerStats;
