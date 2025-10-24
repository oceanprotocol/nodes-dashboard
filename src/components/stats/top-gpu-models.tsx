import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useStatsContext } from '@/context/stats-context';

const TopGpuModels = () => {
  const { topGpuModels } = useStatsContext();

  return (
    <Card direction="column" padding="md" radius="md" spacing="md" variant="glass-shaded">
      <h3>Top GPUs by popularity</h3>
      <HBarChart axisKey="model" barKey="count" data={topGpuModels} />
    </Card>
  );
};

export default TopGpuModels;
