import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useProfileContext } from '@/context/profile-context';
import { formatNumber } from '@/utils/formatters';
import cx from 'classnames';
import { useEffect } from 'react';
import styles from './owner-stats.module.css';

type OwnerStatsProps = {
  /**
   * Grid template shared with the sibling inference Card so the two Cards' columns line up — see
   * owner-section.module.css.
   */
  className?: string;
  /** Places the gauge in the shared template's third track. */
  gaugeClassName?: string;
};

const OwnerStats = ({ className, gaugeClassName }: OwnerStatsProps) => {
  const {
    totalNetworkRevenue,
    totalBenchmarkRevenue,
    totalNetworkJobs,
    totalBenchmarkJobs,
    ownerStatsPerEpoch,
    eligibleNodes,
    totalNodes,
    fetchOwnerStats,
    fetchActiveNodes,
  } = useProfileContext();

  useEffect(() => {
    fetchActiveNodes();
  }, [fetchActiveNodes]);

  useEffect(() => {
    fetchOwnerStats();
  }, [fetchOwnerStats]);

  return (
    <Card className={className} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="totalRevenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={ownerStatsPerEpoch}
        title="Jobs revenue"
        footer={{
          amount: formatNumber(totalNetworkRevenue + totalBenchmarkRevenue),
          currency: 'USDC',
          label: 'Total revenue',
        }}
        minBars={16}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalJobs"
        chartType={ChartTypeEnum.JOBS_PER_EPOCH}
        data={ownerStatsPerEpoch}
        title="Jobs run"
        footer={{
          amount: formatNumber(totalNetworkJobs + totalBenchmarkJobs),
          label: 'Total jobs',
        }}
        minBars={16}
      />
      <div className={cx(styles.gauge, gaugeClassName)}>
        <Gauge
          label="Eligible"
          max={100}
          min={0}
          title="Eligible nodes"
          value={totalNodes > 0 ? Number(((eligibleNodes / totalNodes) * 100).toFixed(1)) : 0}
          valueSuffix="%"
        />
      </div>
    </Card>
  );
};

export default OwnerStats;
