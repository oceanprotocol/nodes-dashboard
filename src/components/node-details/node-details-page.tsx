import Card from '@/components/card/card';
import Container from '@/components/container/container';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import SectionTitle from '@/components/section-title/section-title';
import styles from './node-details-page.module.css';

const NodeDetailsPage = () => {
  return (
    <Container className={styles.root}>
      <SectionTitle
        title="Node details"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className={styles.content}>
        <Card padding="md" radius="md" variant="glass-shaded">
          <h2>Friendly node name</h2>
        </Card>
        <Card padding="md" radius="md" variant="glass-shaded">
          <h3>Unban requests</h3>
        </Card>
        <JobsRevenueStats />
        <Card padding="md" radius="md" variant="glass-shaded">
          <h3>Benchmark jobs history</h3>{' '}
        </Card>
        <Card padding="md" radius="md" variant="glass-shaded">
          <h3>Environments</h3>
        </Card>
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
