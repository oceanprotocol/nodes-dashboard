import Button from '@/components/button/button';
import config, { getRoutes } from '@/config';
import Container from '../container/container';
import styles from './docs-cta-section.module.css';

const DocsCtaSection = () => {
  const routes = getRoutes();

  return (
    <section className={styles.root}>
      <Container className={styles.container}>
        <h1 className={styles.title}>Ready to get started?</h1>
        <p className={styles.description}>
          Run a quick CPU test, or claim $100 in Grant Tokens to unlock high-performance GPU workloads in the same
          environment, all within Ocean Orchestrator
        </p>
        <Button color="primary-inverse" href={routes.runJob.path} size="lg" variant="filled">
          Run a job
        </Button>
        <div className={styles.socialLinks}>
          <Button
            color="accent2"
            contentAfter={<span className={`${styles.socialLinkIcon} ${styles.discordIcon}`} />}
            href={config.socialMedia.discord}
            size="lg"
            target="_blank"
            variant="transparent"
          >
            <span>Join Discord</span>
          </Button>
          <Button
            color="accent2"
            contentAfter={<span className={`${styles.socialLinkIcon} ${styles.xIcon}`} />}
            href={config.socialMedia.twitter}
            size="lg"
            target="_blank"
            variant="transparent"
          >
            <span>Follow on</span>
          </Button>
        </div>
      </Container>
    </section>
  );
};

export default DocsCtaSection;
