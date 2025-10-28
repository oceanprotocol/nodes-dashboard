import Card from '@/components/card/card';
import Container from '@/components/container/container';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeInfo from '@/components/node-details/node-info';
import SectionTitle from '@/components/section-title/section-title';
import { NodeEligibility } from '@/types/nodes';
import styles from './node-details-page.module.css';

const RANDOM_ELIGIBILITY_MOCK =
  Object.values(NodeEligibility)[Math.floor(Math.random() * Object.values(NodeEligibility).length)];

const NodeDetailsPage = () => {
  return (
    <Container className={styles.root}>
      <SectionTitle
        title="Node details"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className={styles.content}>
        <NodeInfo eligibility={RANDOM_ELIGIBILITY_MOCK} />
        {RANDOM_ELIGIBILITY_MOCK === NodeEligibility.BANNED ? (
          <Card padding="md" radius="lg" variant="glass-shaded">
            <h3>Unban requests</h3>
          </Card>
        ) : null}
        <JobsRevenueStats />
        <Card padding="md" radius="lg" variant="glass-shaded">
          <h3>Benchmark jobs history</h3>
        </Card>
        <Card padding="md" radius="lg" variant="glass-shaded">
          <h3>Environments</h3>
        </Card>
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
