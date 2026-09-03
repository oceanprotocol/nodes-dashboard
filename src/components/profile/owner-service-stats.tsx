import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
import { useProfileContext } from '@/context/profile-context';
import { formatNumber } from '@/utils/formatters';
import { useEffect } from 'react';
import styles from './owner-service-stats.module.css';

/*
  The endpoint also returns `uniqueConsumers`, which is deliberately not rendered:
  at owner level it is a documented lower bound, because distinct consumers cannot
  be recombined from per-node rollups without double-counting anyone who used two
  of the owner's nodes. Per-node figures live on the node detail page instead.
*/
const OwnerServiceStats = () => {
  const { ownerServiceRevenue, ownerServiceStatsPerEpoch, ownerTotalServices, fetchOwnerServiceStats } =
    useProfileContext();

  useEffect(() => {
    fetchOwnerServiceStats();
  }, [fetchOwnerServiceStats]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="serviceRevenue"
        chartType={ChartTypeEnum.SERVICE_REVENUE_PER_EPOCH}
        data={[...ownerServiceStatsPerEpoch]}
        title="Inference revenue"
        footer={{
          amount: formatNumber(ownerServiceRevenue),
          currency: 'USDC',
          label: 'Total service revenue',
        }}
        minBars={16}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalServices"
        chartType={ChartTypeEnum.SESSIONS_PER_EPOCH}
        data={[...ownerServiceStatsPerEpoch]}
        title="Inference sessions"
        footer={{
          amount: formatNumber(ownerTotalServices),
          label: 'Total sessions served',
        }}
        minBars={16}
      />
    </Card>
  );
};

export default OwnerServiceStats;
