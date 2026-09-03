import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import HBarChart from '@/components/chart/h-bar-chart';
import VBarChart from '@/components/chart/v-bar-chart';
import StatTile from '@/components/stat-tile/stat-tile';
import { useNodesContext } from '@/context/nodes-context';
import { formatNumber, formatReservedHours } from '@/utils/formatters';
import { useEffect } from 'react';
import styles from './service-stats.module.css';

const ServiceStats = () => {
  const {
    serviceByModel,
    serviceReservedSeconds,
    serviceRevenue,
    serviceRunningNow,
    serviceStatsPerEpoch,
    serviceTotalServices,
    serviceUniqueConsumers,
    fetchNodeServiceStats,
  } = useNodesContext();

  useEffect(() => {
    fetchNodeServiceStats();
  }, [fetchNodeServiceStats]);

  return (
    <>
      <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
        <VBarChart
          axisKey="epochId"
          barKey="serviceRevenue"
          chartType={ChartTypeEnum.SERVICE_REVENUE_PER_EPOCH}
          data={[...serviceStatsPerEpoch]}
          title="Service revenue per epoch"
          footer={{
            amount: formatNumber(serviceRevenue),
            currency: 'USDC',
            label: 'Total service revenue',
          }}
          minBars={16}
        />
        <VBarChart
          axisKey="epochId"
          barKey="totalServices"
          chartType={ChartTypeEnum.SESSIONS_PER_EPOCH}
          data={[...serviceStatsPerEpoch]}
          title="Sessions served per epoch"
          footer={{
            amount: formatNumber(serviceTotalServices),
            label: 'Total sessions served',
          }}
          minBars={16}
        />
        <StatTile
          items={[
            { label: 'Running now', value: formatNumber(serviceRunningNow) },
            { label: 'Consumers served', value: formatNumber(serviceUniqueConsumers) },
            { label: 'Reserved', value: formatReservedHours(serviceReservedSeconds) },
          ]}
          title="Inference sessions"
        />
      </Card>
      {/*
        Only rendered when there is something to plot: a node serving only
        CLI-launched sessions has no recorded models at all, and HBarChart sizes
        its height from the row count, so an empty array collapses to nothing.
      */}
      {serviceByModel.length > 0 ? (
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
          <h3>Top models served</h3>
          <HBarChart axisKey="key" barKey="count" data={serviceByModel} />
          <span className="text10 textSecondary">
            Only sessions launched from the dashboard record a model, so this is a partial view.
          </span>
        </Card>
      ) : null}
    </>
  );
};

export default ServiceStats;
