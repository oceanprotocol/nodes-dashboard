import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import LeaderboardPreview from '@/components/stats/leaderboard-preview';
import NodeSpecStats from '@/components/stats/system-stats';
import TopGpuModels from '@/components/stats/top-gpu-models';
import TopNodes from '@/components/stats/top-nodes';

const StatsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Stats"
        // TODO: replace with actual subtitle
        subTitle="Track jobs, usage, performance and rewards across the network"
      />
      <div className="pageContentWrapper">
        <JobsRevenueStats />
        <LeaderboardPreview />
        <TopGpuModels />
        <NodeSpecStats />
        <TopNodes />
      </div>
    </Container>
  );
};

export default StatsPage;
