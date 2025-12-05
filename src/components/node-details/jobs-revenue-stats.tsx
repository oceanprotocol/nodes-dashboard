import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useNodesContext } from '@/context/nodes-context';
import { useP2P } from '@/contexts/P2PContext';
import { type Node } from '@/types/nodes';
import { formatNumber } from '@/utils/formatters';
import { useEffect, useMemo } from 'react';
import styles from './jobs-revenue-stats.module.css';

type JobsRevenueStatsProps = {
  node: Node;
};

const JobsRevenueStats = ({ node }: JobsRevenueStatsProps) => {
  const {
    benchmarkValues,
    jobsPerEpoch,
    revenuePerEpoch,
    totalJobs,
    totalRevenue,
    fetchNodeBenchmarkMinMaxLast,
    fetchNodeStats,
  } = useNodesContext();
  const { envs, getEnvs } = useP2P();

  useEffect(() => {
    fetchNodeStats();
  }, [fetchNodeStats]);

  useEffect(() => {
    fetchNodeBenchmarkMinMaxLast();
  }, [fetchNodeBenchmarkMinMaxLast]);

  useEffect(() => {
    getEnvs(node?.id!);
  }, [node?.id, getEnvs]);

  const runningAndTotalJobs = useMemo(() => {
    let totalRunningJobs = 0;
    let totalJobs = 0;
    for (const env of envs) {
      totalRunningJobs += env.runningJobs + (env.runningFreeJobs || 0);
      totalJobs += env.queuedJobs + totalRunningJobs;
    }

    return [totalJobs, totalRunningJobs];
  }, [envs]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <VBarChart
        axisKey="epochId"
        barKey="totalRevenue"
        chartType={ChartTypeEnum.REVENUE_PER_EPOCH}
        data={revenuePerEpoch}
        title="Revenue per epoch"
        footer={{
          amount: formatNumber(totalRevenue),
          currency: 'USDC',
          label: 'Total revenue',
        }}
      />
      <Gauge label="Running" max={runningAndTotalJobs[0]} min={0} title="Queued jobs" value={runningAndTotalJobs[1]} />
      <Gauge
        label="Latest"
        max={benchmarkValues.maxGPUScore || 0}
        min={benchmarkValues.minGPUScore || 0}
        title="Benchmark results"
        value={benchmarkValues.lastGPUScore || 0}
      />
      <VBarChart
        axisKey="epochId"
        barKey="totalJobs"
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
