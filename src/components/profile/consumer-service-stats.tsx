import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
import StatTile from '@/components/stat-tile/stat-tile';
import { useProfileContext } from '@/context/profile-context';
import { formatDuration, formatNumber } from '@/utils/formatters';
import { useEffect } from 'react';
import styles from './consumer-service-stats.module.css';

const ConsumerServiceStats = () => {
  const {
    activeServices,
    avgServiceCostUsdc,
    avgServiceDurationSeconds,
    consumerServiceStatsPerEpoch,
    servicesExpiringSoon,
    totalServicePaidAmount,
    totalServices,
    fetchConsumerServiceStats,
  } = useProfileContext();

  useEffect(() => {
    fetchConsumerServiceStats();
  }, [fetchConsumerServiceStats]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="paidAmount"
        chartType={ChartTypeEnum.SERVICE_REVENUE_PER_EPOCH}
        data={[...consumerServiceStatsPerEpoch]}
        title="Inference spend"
        footer={{
          amount: formatNumber(totalServicePaidAmount),
          currency: 'USDC',
          label: 'Total paid',
        }}
        minBars={16}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalServices"
        chartType={ChartTypeEnum.SESSIONS_PER_EPOCH}
        data={[...consumerServiceStatsPerEpoch]}
        title="Inference sessions"
        footer={{
          amount: formatNumber(totalServices),
          label: 'Total sessions',
        }}
        minBars={16}
      />
      {/*
        A StatTile rather than a Gauge: every figure here is an unbounded count or
        an average, so a Gauge would need a fabricated `max` to render.
      */}
      <StatTile
        items={[
          { label: 'Running now', value: formatNumber(activeServices) },
          { label: 'Expiring in 24h', value: formatNumber(servicesExpiringSoon) },
          { label: 'Avg duration', value: formatDuration(avgServiceDurationSeconds, true) },
          { label: 'Avg cost', value: `USDC ${formatNumber(Number(avgServiceCostUsdc.toFixed(2)))}` },
        ]}
        title="Your sessions"
      />
    </Card>
  );
};

export default ConsumerServiceStats;
