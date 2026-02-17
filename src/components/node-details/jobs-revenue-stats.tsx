import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import Gauge from '@/components/chart/gauge';
import VBarChart from '@/components/chart/v-bar-chart';
import { useNodesContext } from '@/context/nodes-context';
import { useP2P } from '@/contexts/P2PContext';
import { formatNumber } from '@/utils/formatters';
import { useEffect, useMemo } from 'react';
import styles from './jobs-revenue-stats.module.css';

const JobsRevenueStats = () => {
  const {
    benchmarkValues,
    jobsPerEpoch,
    revenuePerEpoch,
    totalJobs,
    totalRevenue,
    fetchNodeBenchmarkMinMaxLast,
    fetchNodeStats,
  } = useNodesContext();
  const { envs } = useP2P();

  useEffect(() => {
    fetchNodeStats();
  }, [fetchNodeStats]);

  useEffect(() => {
    fetchNodeBenchmarkMinMaxLast();
  }, [fetchNodeBenchmarkMinMaxLast]);

  const queuedJobsData = useMemo(() => {
    let totalQueuedJobs = 0;
    let totalRunningJobs = 0;
    let totalWaitTimeSeconds = 0;

    for (const env of envs) {
      totalQueuedJobs += (env.queuedJobs ?? 0) + (env.queuedFreeJobs ?? 0);
      totalRunningJobs += (env.runningJobs ?? 0) + (env.runningFreeJobs ?? 0);
      totalWaitTimeSeconds +=
        (env.queMaxWaitTime ?? 0) +
        (env.queMaxWaitTimeFree ?? 0) +
        (env.runMaxWaitTime ?? 0) +
        (env.runMaxWaitTimeFree ?? 0);
    }

    const jobCount = totalQueuedJobs + totalRunningJobs;
    const totalDurationHours = totalWaitTimeSeconds / 3600;

    return { jobCount, totalDurationHours };
  }, [envs]);

  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" shadow="black" variant="glass-shaded">
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
      <Gauge
        centerLabel="Jobs"
        centerValue={queuedJobsData.jobCount}
        max={24}
        min={0}
        title="Ongoing jobs"
        value={queuedJobsData.totalDurationHours}
        valueSuffix="h"
      />
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
