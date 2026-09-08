import Card from '@/components/card/card';
import HBarChart from '@/components/chart/h-bar-chart';
import { useServicesStatsContext } from '@/context/services-stats-context';
import { useEffect } from 'react';

const MAX_LABEL_CHARS = 20;

const TopModels = () => {
  const { modelCoverage, modelPopularity, modelPopularityError, modelPopularityLoading, fetchModelPopularity } =
    useServicesStatsContext();

  useEffect(() => {
    fetchModelPopularity();
  }, [fetchModelPopularity]);

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Top models by sessions</h3>
      {modelPopularityLoading && modelPopularity.length === 0 ? (
        <span className="textSecondary">Loading model usage…</span>
      ) : modelPopularityError ? (
        // Distinct from the empty state below: a failed request is not proof
        // that no model was recorded.
        <span className="textSecondary">{modelPopularityError}</span>
      ) : modelPopularity.length > 0 ? (
        <>
          <HBarChart axisKey="model" barKey="sessions" data={modelPopularity} maxLabelChars={MAX_LABEL_CHARS} />
          {/*
            Coverage is shown rather than hidden: only launches made from the
            dashboard record a model, because the node's service listing strips
            dockerCmd. CLI, MCP and direct-node launches have none.
          */}
          <span className="text10 textSecondary">Covers {Math.round(modelCoverage * 100)}% of sessions.</span>
        </>
      ) : (
        <span className="textSecondary">No model usage recorded yet.</span>
      )}
    </Card>
  );
};

export default TopModels;
