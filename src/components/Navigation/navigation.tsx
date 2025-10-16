import DiscordIcon from '@/assets/discord.svg';
import Logo from '@/assets/logo.svg';
import XIcon from '@/assets/x.svg';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import config, { getRoutes } from '../../config';
import Button from '../button/button';
import Container from '../container/container';
import styles from './navigation.module.css';

const Navigation = () => {
  const router = useRouter();
  const routes = getRoutes();

  return (
    <div className={styles.root}>
      <Container className={styles.container}>
        <div className={styles.logoWrapper}>
          <Link href="/">
            <Logo width={65} />
          </Link>
        </div>
        <div className={styles.navLinks}>
          {Object.values(routes).map((route) => (
            <Link
              key={route.path}
              href={route.path}
              className={cx(styles.navLink, router.pathname === route.path && styles.active)}
            >
              {route.name}
            </Link>
          ))}
        </div>
        <div className={styles.sideActions}>
          <Link href={config.socialMedia.discord} className={styles.actioniconLink}>
            <DiscordIcon width={40} height={40} />
          </Link>
          <Link href={config.socialMedia.discord} className={styles.actioniconLink}>
            <XIcon width={40} height={35} />
          </Link>
          <Button href={config.socialMedia.discord}>Log in</Button>
        </div>
      </Container>
    </div>
  );
};

export default Navigation;
