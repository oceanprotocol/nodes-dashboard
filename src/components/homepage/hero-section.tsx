import { getRoutes } from '@/config';
import { SHOWCASE_ITEMS } from '@/services/showcase';
import Button from '../button/button';
import Container from '../container/container';
import ShowcaseStack from '../showcase/showcase-stack';
import styles from './hero-section.module.css';
import LegacyEscrowBanner from './legacy-escrow-banner';

export default function HeroSection() {
  return (
    <section className={styles.root}>
      <Container className={styles.introBand}>
        <LegacyEscrowBanner className={styles.legacyEscrowBanner} escrowPageLink />
        <div className={styles.intro}>
          <div className={styles.introText}>
            <h1 className={styles.title}>
              <span className={styles.titleLead}>Start creating</span>
              <span className={styles.titleRest}>
                your next <em>viral video</em>
              </span>
            </h1>
            <p className={styles.subtitle}>Generate images and video on GPUs booked by the hour.</p>
          </div>
          <div className={styles.actions}>
            <Button color="accent1" href={getRoutes().inference.path} size="lg">
              Use a model
            </Button>
            <Button color="accent1" href={getRoutes().runJob.path} size="lg" variant="outlined">
              Run a job
            </Button>
          </div>
        </div>
      </Container>
      <Container>
        <ShowcaseStack aria-label="Made on Ocean Network" className={styles.showcase} items={SHOWCASE_ITEMS} />
      </Container>
    </section>
  );
}
