import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useServicesStatsContext } from '@/context/services-stats-context';
import { useEffect } from 'react';

const TopApps = () => {
  const { appPopularity, appPopularityError, appPopularityLoading, fetchAppPopularity } = useServicesStatsContext();

  useEffect(() => {
    fetchAppPopularity();
  }, [fetchAppPopularity]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Top apps by sessions</h3>
      {appPopularityLoading && appPopularity.length === 0 ? (
        <span className="textSecondary">Loading app usage…</span>
      ) : appPopularityError ? (
        // Distinct from the empty state below: a failed request is not proof
        // that nothing was used.
        <span className="textSecondary">{appPopularityError}</span>
      ) : appPopularity.length > 0 ? (
        <>
          <HBarChart axisKey="image" barKey="sessions" data={appPopularity} entityKind="app" />
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
