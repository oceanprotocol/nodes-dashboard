import DiscordIcon from '@/assets/discord.svg';
import Logo from '@/assets/logo.svg';
import XIcon from '@/assets/x.svg';
import ProfileButton from '@/components/Navigation/profile-button';
import cx from 'classnames';
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const renderNavLinks = (className: string) =>
    Object.values(routes).map((route) => (
      <Link
        key={route.path}
        href={route.path}
        className={cx(className, router.pathname === route.path && styles.active)}
      >
        {route.name}
      </Link>
    ));

  const Actions = ({ className }: { className: string }) => (
    <div className={className}>
      <Link href={config.socialMedia.discord} className={styles.actionIconLink} target="_blank" rel="noreferrer">
        <DiscordIcon width={32} height={32} />
      </Link>
      <Link href={config.socialMedia.twitter} className={styles.actionIconLink} target="_blank" rel="noreferrer">
        <XIcon width={30} height={28} />
      </Link>
      <ProfileButton />
    </div>
  );

  return (
    <header className={styles.root}>
      <Container className={styles.container}>
        <div className={styles.logoWrapper}>
          <Link href="/" aria-label="Home">
            <Logo width={65} />
          </Link>
        </div>
        <nav className={styles.desktopNav} aria-label="Primary">
          {renderNavLinks(styles.navLink)}
        </nav>
        <Actions className={styles.sideActions} />
        <button
          type="button"
          className={cx(styles.menuToggle, isMenuOpen && styles.menuToggleOpen)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </Container>
      <div
        id="mobile-navigation"
        className={cx(styles.mobileMenu, isMenuOpen && styles.mobileMenuOpen)}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.mobileMenuHeader}>
          <Logo width={52} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            <span />
            <span />
          </button>
        </div>
        <nav className={styles.mobileNavLinks} aria-label="Mobile primary">
          {renderNavLinks(styles.mobileNavLink)}
        </nav>
        <Actions className={styles.mobileActions} />
      </div>
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
