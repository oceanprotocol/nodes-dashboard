import Logo from '@/assets/logo.svg';
import Container from '@/components/container/container';
import config, { getLinks, getRoutes } from '@/config';
import Link from 'next/link';
import styles from './footer-section.module.css';

const FooterSection = () => {
  const currentYear = new Date().getFullYear();
  const links = getLinks();
  const routes = getRoutes();

  const pageKeys = ['runJob', 'stats', 'docs', 'leaderboard', 'runNode'] as const;

  return (
    <section className={styles.root}>
      <div className={styles.background} />
      <Container className={styles.container}>
        <div className={styles.upperRow}>
          <div className={styles.brandColumn}>
            <div className={styles.brandHeading}>
              <Logo width={65} />
              <div className={styles.brandTitleGroup}>
                <span className={styles.brandTitle}>Ocean Network</span>
                <span className={styles.brandSubtitle}>Decentralized Compute Alliance</span>
              </div>
            </div>
            <p className={styles.description}>
              Keep your data, jobs, and infrastructure secure while tapping into a global network of decentralized
              compute.
            </p>
            <p className={styles.copy}>
              © {currentYear} All Rights Reserved. Powered by{' '}
              <a href={links.website} target="_blank" rel="noreferrer">
                Ocean Network
              </a>
              .
            </p>
          </div>
          <div className={styles.pagesColumn}>
            <span className={styles.columnTitle}>Pages</span>
            <ul className={styles.pagesList}>
              {pageKeys.map((key) => {
                const route = routes[key];
                if (!route) {
                  return null;
                }

                return (
                  <li key={route.path}>
                    <Link href={route.path} className={styles.pageLink}>
                      {route.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className={styles.lowerRow}>
          <div className={styles.socialLinks}>
            <a href={config.socialMedia.discord} target="_blank" rel="noreferrer">
              Discord
            </a>
            <a href={config.socialMedia.twitter} target="_blank" rel="noreferrer">
              X (Twitter)
            </a>
            <a href={config.socialMedia.youtube} target="_blank" rel="noreferrer">
              YouTube
            </a>
          </div>
          <div className={styles.legalLinks}>
            <a href="#" className={styles.legalLink}>
              Terms
            </a>
            <a href="#" className={styles.legalLink}>
              Privacy
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default FooterSection;
