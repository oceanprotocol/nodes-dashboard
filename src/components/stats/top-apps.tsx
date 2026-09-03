import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useServicesStatsContext } from '@/context/services-stats-context';
import { useEffect } from 'react';

const TopApps = () => {
  const { appPopularity, fetchAppPopularity } = useServicesStatsContext();

  useEffect(() => {
    fetchAppPopularity();
  }, [fetchAppPopularity]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Top apps by sessions</h3>
      {appPopularity.length > 0 ? (
        <>
          <HBarChart axisKey="image" barKey="sessions" data={appPopularity} />
          {/*
            "Apps", not "templates": this is grouped by container image, and every
            bundle runs its parent service's image, so variants cannot be told apart.
          */}
          <span className="text10 textSecondary">
            Grouped by container image, so variants of the same app are counted together.
          </span>
        </>
      ) : (
        <span className="textSecondary">No app usage recorded yet.</span>
      )}
    </Card>
  );
};

export default TopApps;
