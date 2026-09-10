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
          Claim complimentary credits to unlock high-performance GPU workloads like running any open model &amp; running
          compute jobs, or simply run a quick CPU test within Ocean Orchestrator
        </p>
        <div className={styles.actions}>
          <Button color="on-accent1" href={routes.inference.path} size="lg" variant="filled">
            Use a model
          </Button>
          <Button color="on-accent1" href={routes.runJob.path} size="lg" variant="outlined">
            Run a job
          </Button>
        </div>
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
