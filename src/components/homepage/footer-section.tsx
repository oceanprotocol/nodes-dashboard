import Button from '@/components/button/button';
import Container from '@/components/container/container';
import config, { getLinks, getRoutes } from '@/config';
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
              <div className={styles.brandTitleGroup}>
                <span className={styles.brandTitle}>Ocean Network</span>
              </div>
            </div>
            <p className={styles.description}>
              Ocean Network is a decentralized, peer-to-peer (P2P) compute network for pay-per-use compute jobs that
              turns idle or underutilized GPUs into usable distributed compute resources.
            </p>
            <p className={styles.copy}>
              © {currentYear} All Rights Reserved. Powered by{' '}
              <Button color="accent2" href={links.website} size="link" target="_blank" variant="transparent">
                Ocean Network
              </Button>
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
                    <Button color="primary-inverse" href={route.path} size="link" variant="transparent">
                      {route.name}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className={styles.lowerRow}>
          <div className={styles.socialLinks}>
            <Button
              color="primary-inverse"
              href={config.socialMedia.discord}
              size="link"
              target="_blank"
              variant="transparent"
            >
              Discord
            </Button>
            <Button
              color="primary-inverse"
              href={config.socialMedia.twitter}
              size="link"
              target="_blank"
              variant="transparent"
            >
              X (Twitter)
            </Button>
            <Button
              color="primary-inverse"
              href={config.socialMedia.youtube}
              size="link"
              target="_blank"
              variant="transparent"
            >
              YouTube
            </Button>
          </div>
          <div className={styles.legalLinks}>
            <Button color="primary-inverse" href="#" size="link" variant="transparent">
              Terms
            </Button>
            <Button color="primary-inverse" href="#" size="link" variant="transparent">
              Privacy
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default FooterSection;
