import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
import { useServicesStatsContext } from '@/context/services-stats-context';
import { formatNumber } from '@/utils/formatters';
import { useEffect } from 'react';
import styles from './inference-stats.module.css';

const InferenceStats = () => {
  const { statsPerEpoch, totalServiceRevenue, totalServices, fetchServiceGlobalStats } = useServicesStatsContext();

  useEffect(() => {
    fetchServiceGlobalStats();
  }, [fetchServiceGlobalStats]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
      <div className={styles.revenueWrapper}>
        <h3 className={styles.heading}>Network service revenue</h3>
        <div className={styles.revenue}>
          <span className={styles.token}>USDC</span>{' '}
          <span className={styles.amount}>{formatNumber(totalServiceRevenue)}</span>
        </div>
      </div>
      {/*
        Both charts read different keys off the SAME rows, and VBarChart sorts its
        `data` prop in place — so each gets its own copy rather than reordering the
        array held in context.
      */}
      <VBarChart
        axisKey="epochId"
        barKey="serviceRevenue"
        chartType={ChartTypeEnum.SERVICE_REVENUE_PER_EPOCH}
        data={[...statsPerEpoch]}
        minBars={16}
        title="Revenue per epoch"
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalServices"
        chartType={ChartTypeEnum.SESSIONS_PER_EPOCH}
        data={[...statsPerEpoch]}
        footer={{
          amount: formatNumber(totalServices),
          label: 'Total sessions',
        }}
        minBars={16}
        title="Sessions per epoch"
      />
    </Card>
  );
};

export default InferenceStats;
