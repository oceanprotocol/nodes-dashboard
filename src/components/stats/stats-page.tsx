import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import JobsRevenueStats from '@/components/stats/jobs-revenue-stats';
import NodeSpecStats from '@/components/stats/system-stats';
import TopGpuModels from '@/components/stats/top-gpu-models';
import TopNodes from '@/components/stats/top-nodes';
import styles from './stats-page.module.css';

const StatsPage = () => {
  return (
    <Container className={styles.root}>
      <SectionTitle
        title="Stats"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className={styles.content}>
        <JobsRevenueStats />
        <TopGpuModels />
        <NodeSpecStats />
        <TopNodes />
      </div>
    </Container>
  );
};

export default StatsPage;
