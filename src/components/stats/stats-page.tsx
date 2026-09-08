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
import styles from './stats-page.module.css';

const StatsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle moreReadable title="Stats" />

      {/*
        Three groups, each its own <section> with a `secondary` SectionTitle rather than
        another default one: the default is the page header (centered, 48px, one per page), so
        repeating it mid-page made each group read as a separate page. The group spacing
        lives here instead of `pageContentWrapper`, whose single 24px gap gave a heading
        the same breathing room as two adjacent cards.
      */}
      <div className={styles.sections}>
        <section className={styles.section}>
          <SectionTitle
            secondary
            title="Job stats"
            subTitle="Compute jobs, spend and success rates across the network"
          />
          <div className={styles.group}>
            <JobsRevenueStats />
          </div>
        </section>

        {/*
          Services get their own section rather than being folded into the jobs KPIs above:
          those numbers are compute-job revenue and have been read as such, and service
          economics are priced on reserved time, not work done.
        */}
        <section className={styles.section}>
          <SectionTitle
            secondary
            title="Inference and services stats"
            subTitle="Inference sessions, spend, and the models and apps being run across the network"
          />
          <div className={styles.group}>
            <InferenceStats />
            <div className={styles.pair}>
              <TopModels />
              <TopApps />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <SectionTitle
            secondary
            title="Nodes and hardware stats"
            subTitle="Node rewards, performance and the hardware running the network"
          />
          <div className={styles.group}>
            <LeaderboardPreview />
            <TopGpuModels />
            <NodeSpecStats />
            <TopNodes />
          </div>
        </section>
      </div>
    </Container>
  );
};

export default StatsPage;
