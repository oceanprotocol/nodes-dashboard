import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import InferenceStats from '@/components/stats/inference-stats';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import LeaderboardPreview from '@/components/stats/leaderboard-preview';
import NodeSpecStats from '@/components/stats/system-stats';
import TopApps from '@/components/stats/top-apps';
import TopGpuModels from '@/components/stats/top-gpu-models';
import TopModels from '@/components/stats/top-models';
import TopNodes from '@/components/stats/top-nodes';

const StatsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Network jobs"
        subTitle="Track compute jobs, spend and success rates across the network"
      />
      <div className="pageContentWrapper">
        <JobsRevenueStats />
        {/*
          Services get their own section rather than being folded into the jobs
          KPIs above: those numbers are compute-job revenue and have been read as
          such, and service economics are priced on reserved time, not work done.
        */}
        <SectionTitle
          moreReadable
          title="Inference & Services"
          subTitle="Track inference sessions, spend and the models and apps being run across the network"
        />
        <InferenceStats />
        <TopModels />
        <TopApps />
        {/*
          The node and hardware sections need a heading of their own: without one
          they render below "Inference & Services" and read as part of it.
        */}
        <SectionTitle
          moreReadable
          title="Nodes & hardware"
          subTitle="Track node rewards, performance and the hardware running the network"
        />
        <LeaderboardPreview />
        <TopGpuModels />
        <NodeSpecStats />
        <TopNodes />
      </div>
    </Container>
  );
};

export default StatsPage;
