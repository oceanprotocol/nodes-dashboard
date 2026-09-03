import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useServicesStatsContext } from '@/context/services-stats-context';
import { useEffect } from 'react';

const TopModels = () => {
  const { modelCoverage, modelPopularity, fetchModelPopularity } = useServicesStatsContext();

  useEffect(() => {
    fetchModelPopularity();
  }, [fetchModelPopularity]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Top models by sessions</h3>
      {modelPopularity.length > 0 ? (
        <>
          <HBarChart axisKey="model" barKey="sessions" data={modelPopularity} />
          {/*
            Coverage is shown rather than hidden: only launches made from the
            dashboard record a model, because the node's service listing strips
            dockerCmd. CLI, MCP and direct-node launches have none.
          */}
          <span className="text10 textSecondary">
            Covers {Math.round(modelCoverage * 100)}% of sessions — only launches made from the dashboard record a
            model.
          </span>
        </>
      ) : (
        <span className="textSecondary">No model usage recorded yet.</span>
      )}
    </Card>
  );
};

export default TopModels;
