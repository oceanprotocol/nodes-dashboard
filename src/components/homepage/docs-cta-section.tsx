import config, { getRoutes } from '@/config';
import Link from 'next/link';
import Container from '../container/container';
import styles from './docs-cta-section.module.css';

const DocsCtaSection = () => {
  const routes = getRoutes();

  return (
    <section className={styles.root}>
      <Container className={styles.container}>
        <h1 className={styles.title}>Build The Future Of AI With Decentralized Compute</h1>
        <Link href={routes.docs.path} className={styles.docsButton}>
          <span>Explore Docs</span>
          <span className={styles.buttonIcon}>▸</span>
        </Link>
        <div className={styles.socialLinks}>
          <Link href={config.socialMedia.discord} target="_blank" rel="noreferrer" className={styles.socialLink}>
            <span>Join Discord</span>
            <span className={`${styles.socialLinkIcon} ${styles.discordIcon}`} />
          </Link>
          <Link href={config.socialMedia.twitter} target="_blank" rel="noreferrer" className={styles.socialLink}>
            <span>Follow On</span>
            <span className={`${styles.socialLinkIcon} ${styles.xIcon}`} />
          </Link>
        </div>
      </Container>
    </section>
  );
};

export default DocsCtaSection;
