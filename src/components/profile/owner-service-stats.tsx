import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import VBarChart from '@/components/chart/v-bar-chart';
import StatTile from '@/components/stat-tile/stat-tile';
import { useProfileContext } from '@/context/profile-context';
import { formatDuration, formatNumber, formatReservedHours } from '@/utils/formatters';
import cx from 'classnames';
import { useEffect } from 'react';
import styles from './owner-service-stats.module.css';

type OwnerServiceStatsProps = {
  /** Grid template shared with the sibling jobs Card — see owner-section.module.css. */
  className?: string;
  /** Places the tile in the shared template's third track. */
  tileClassName?: string;
};

/*
  The endpoint also returns `uniqueConsumers`, which is deliberately not rendered:
  at owner level it is a documented lower bound, because distinct consumers cannot
  be recombined from per-node rollups without double-counting anyone who used two
  of the owner's nodes. Per-node figures live on the node detail page instead.
*/
const OwnerServiceStats = ({ className, tileClassName }: OwnerServiceStatsProps) => {
  const {
    ownerServiceRevenue,
    ownerServiceStatsPerEpoch,
    ownerTotalServices,
    ownerReservedSeconds,
    fetchOwnerServiceStats,
  } = useProfileContext();

  useEffect(() => {
    fetchOwnerServiceStats();
  }, [fetchOwnerServiceStats]);

  /*
    Every figure in the tile comes from the endpoint's all-time totals, never the per-epoch rows.
    Those rows' `activeServices` is documented as "sessions that overlapped this epoch", so the
    newest one is a partly-elapsed window rather than a live count — reading it as "running now"
    would report sessions that have already ended. `uniqueNodes` is unusable for a different reason:
    the owner rollup returns it null on every epoch.

    "Total reserved" is booked time, not consumed time — a session reserved for an hour and stopped
    after five minutes still books the hour — so it is named for what it measures rather than
    presented as time actually served. The node does not record the latter.

    The two averages are derived here because the owner endpoint carries no average fields, where
    the consumer one does (`avgServiceDurationSeconds`, `avgServiceCostUsdc`). Each divides two of
    those same all-time totals, so both are means over every session counted above, not averages of
    per-epoch averages. "Avg revenue" rather than the consumer tile's "Avg cost": one session is a
    cost to the consumer and earnings to the node owner reading this page.
  */
  const avgSessionSeconds = ownerTotalServices > 0 ? ownerReservedSeconds / ownerTotalServices : 0;
  const avgRevenueUsdc = ownerTotalServices > 0 ? ownerServiceRevenue / ownerTotalServices : 0;

  return (
    <Card className={className} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
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
      <div className={cx(styles.tile, tileClassName)}>
        <StatTile
          items={[
            { label: 'Total reserved', value: formatReservedHours(ownerReservedSeconds) },
            { label: 'Avg duration', value: formatDuration(avgSessionSeconds, true) },
            { label: 'Avg revenue', value: `USDC ${formatNumber(Number(avgRevenueUsdc.toFixed(2)))}` },
          ]}
          title="Inference activity"
        />
      </div>
    </Card>
  );
};

export default OwnerServiceStats;
