import Card from '@/components/card/card';
import { ChartTypeEnum } from '@/components/chart/chart-type';
import PieChart from '@/components/chart/pie-chart';
import { useStatsContext } from '@/context/stats-context';
import { SystemStatsData } from '@/types/stats';
import { useEffect } from 'react';
import styles from './system-stats.module.css';

const brandColors = {
  primary: ['#009bff', '#0084dc', '#006eb9', '#005896', '#004273', '#002c50'],
  other: '#ffffff',
};

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  details?: string[];
}

const processChartData = (data: Record<string, number>, maxSlices: number): ChartDataItem[] => {
  if (!data) return [];

  const sortedEntries = Object.entries(data).sort(([, a], [, b]) => b - a);

  const mainEntries = sortedEntries.slice(0, maxSlices);
  const otherEntries = sortedEntries.slice(maxSlices);
  const otherCount = otherEntries.reduce((sum, [, count]) => sum + count, 0);

  const result = mainEntries.map(
    ([key, count], index): ChartDataItem => ({
      name: key,
      value: count,
      color: brandColors.primary[index],
    })
  );

  if (otherCount > 0) {
    result.push({
      name: 'Other',
      value: otherCount,
      color: brandColors.other,
      details: otherEntries.map(([key, count]) => `${key}: ${count} nodes`),
    });
  }

  return result;
};

const processCpuData = (stats: SystemStatsData): ChartDataItem[] => {
  if (!stats?.cpuCounts) return [];
  const data = processChartData(stats.cpuCounts, 5);
  return data.map((item) => ({
    ...item,
    name: item.name === 'Other' ? item.name : `${item.name} CPU${item.name !== '1' ? 's' : ''}`,
    details: item.details?.map((detail) => {
      const [count, nodes] = detail.split(':');
      return `${count} CPU${count !== '1' ? 's' : ''}:${nodes}`;
    }),
  }));
};

const processOsData = (stats: SystemStatsData): ChartDataItem[] => {
  if (!stats?.operatingSystems) return [];
  return processChartData(stats.operatingSystems, 3);
};

const processCpuArchData = (stats: SystemStatsData): ChartDataItem[] => {
  if (!stats?.cpuArchitectures) return [];
  const data = processChartData(stats.cpuArchitectures, 3);

  return data.map((item) => ({
    ...item,
    name: item.name.toUpperCase(),
    details: item.details?.map((detail) => detail.toUpperCase()),
  }));
};

const SystemStats = () => {
  const { fetchSystemStats, systemStats } = useStatsContext();

  useEffect(() => {
    if (!systemStats.cpuCounts || Object.keys(systemStats.cpuCounts).length === 0) {
      fetchSystemStats();
    }
  }, [fetchSystemStats, systemStats.cpuCounts]);

  return (
    <Card className={styles.root} paddingX="lg" paddingY="sm" radius="lg" variant="glass-shaded">
      <PieChart
        chartType={ChartTypeEnum.CPU_CORES_DISTRIBUTION}
        data={processCpuData(systemStats)}
        title="CPU cores distribution"
      />
      <PieChart chartType={ChartTypeEnum.OS_DISTRIBUTION} data={processOsData(systemStats)} title="Operating systems" />
      <PieChart
        chartType={ChartTypeEnum.CPU_ARCH_DISTRIBUTION}
        data={processCpuArchData(systemStats)}
        title="CPU architecture"
      />
    </Card>
  );
};

export default SystemStats;
