import DiscordIcon from '@/assets/discord.svg';
import Logo from '@/assets/logo.svg';
import XIcon from '@/assets/x.svg';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import ProfileButton from '@/components/Navigation/profile-button';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { default as classNames, default as cx } from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import config, { getRoutes } from '../../config';
import Container from '../container/container';
import styles from './navigation.module.css';

const Navigation = () => {
  const router = useRouter();
  const routes = getRoutes();

  const scrollPositionRef = useRef(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolledBottom, setIsScrolledBottom] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleScroll = () => {
    setIsScrolledBottom(window.scrollY > 0);
  };

  useEffect(() => {
    if (window) {
      if (isMenuOpen) {
        window.removeEventListener('scroll', handleScroll);
      } else {
        window.addEventListener('scroll', handleScroll);
      }
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    if (isMenuOpen) {
      scrollPositionRef.current = window.scrollY;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollPositionRef.current}px`;
      body.style.width = '100%';
    } else {
      html.style.overflow = '';
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      window.scrollTo(0, scrollPositionRef.current);
    }

    return () => {
      html.style.overflow = '';
      body.style.overflow = '';
      if (body.style.top) {
        const scrollY = Math.abs(parseInt(body.style.top, 10));
        body.style.position = '';
        body.style.top = '';
        body.style.width = '';
        window.scrollTo(0, scrollY || scrollPositionRef.current);
      } else {
        body.style.position = '';
        body.style.width = '';
      }
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [router.pathname]);

  const renderNavLinks = (className?: string) =>
    Object.values(routes).map((route) => {
      const isActive = router.pathname === route.path;
      return (
        <Button
          className={className}
          color={isActive ? 'accent2' : 'primary'}
          key={route.path}
          href={route.path}
          variant={isActive ? 'filled' : 'transparent'}
        >
          {route.name}
        </Button>
      );
    });

  const Actions = ({ className }: { className: string }) => (
    <div className={className}>
      <Button color="primary-inverse" href={config.socialMedia.discord} size="sm-const" target="_blank" variant="glass">
        <DiscordIcon width={30} height={30} />
      </Button>
      <Button color="primary-inverse" href={config.socialMedia.twitter} size="sm-const" target="_blank" variant="glass">
        <XIcon width={30} height={30} />
      </Button>
      <ProfileButton />
    </div>
  );

  return (
    <header className={styles.root}>
      <div className={styles.bgBlur} />
      <Container className={classNames(styles.container, { [styles.containerScrolledBottom]: isScrolledBottom })}>
        <div className={styles.logoWrapper}>
          <Link href="/" aria-label="Home">
            <Logo
              className={classNames(styles.logo, { [styles.logoScrolledBottom]: isScrolledBottom })}
              preserveAspectRatio="xMidYMin slice"
            />
          </Link>
        </div>
        <Card aria-label="Primary" className={styles.desktopNav} shadow="black" variant="glass-shaded">
          {renderNavLinks()}
        </Card>
        <Actions className={styles.sideActions} />
        <Button
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          className={styles.menuToggle}
          contentBefore={<MenuIcon />}
          color="accent1"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          size="md"
          type="button"
          variant="filled"
        >
          Menu
        </Button>
      </Container>
      <Card
        aria-modal="true"
        className={cx(styles.mobileMenu, isMenuOpen && styles.mobileMenuOpen)}
        id="mobile-navigation"
        role="dialog"
        shadow="black"
        variant="glass-shaded"
      >
        <div className={styles.mobileMenuHeader}>
          <Logo width={52} />
          <Button
            aria-label="Close menu"
            color="accent1"
            onClick={() => setIsMenuOpen(false)}
            size="md-const"
            type="button"
            variant="filled"
          >
            <CloseIcon />
          </Button>
        </div>
        <nav className={styles.mobileNavLinks} aria-label="Mobile primary">
          {renderNavLinks()}
        </nav>
        <Actions className={styles.mobileActions} />
      </Card>
      <button
        type="button"
        className={cx(styles.mobileBackdrop, isMenuOpen && styles.mobileBackdropVisible)}
        onClick={() => setIsMenuOpen(false)}
        aria-hidden={!isMenuOpen}
        tabIndex={-1}
      />
    </header>
  );
};

export default Navigation;
