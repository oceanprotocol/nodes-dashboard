import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useStatsContext } from '@/context/stats-context';
import { useEffect } from 'react';

const TopGpuModels = () => {
  const { topGpuModels, fetchTopGpus } = useStatsContext();

  useEffect(() => {
    fetchTopGpus();
  }, [fetchTopGpus]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Top GPUs by popularity</h3>
      <HBarChart axisKey="gpu_name" barKey="popularity" data={topGpuModels} />
    </Card>
  );
};

export default TopGpuModels;
