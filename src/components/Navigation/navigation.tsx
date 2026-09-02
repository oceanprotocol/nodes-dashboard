import DiscordIcon from '@/assets/discord.svg';
import Logo from '@/assets/logo.svg';
import XIcon from '@/assets/x.svg';
import Avatar from '@/components/avatar/avatar';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatWalletAddress } from '@/utils/formatters';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { CircularProgress } from '@mui/material';
import { default as classNames, default as cx } from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import config, { getRoutes } from '../../config';
import Container from '../container/container';
import styles from './navigation.module.css';

/**
 * Resolves what the account slot should render. The connected state is only trusted after mount
 * so server and client markup agree; while Privy is authenticated but the wallet has not resolved
 * we show a spinner, falling back to the login button if a stale session never connects.
 */
const useAccountSlotState = () => {
  const { account, authenticated, isConnecting } = useOceanAccount();

  const [isMounted, setIsMounted] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setHasTimedOut(false);
    if (authenticated && !account.isConnected) {
      const timer = setTimeout(() => setHasTimedOut(true), 4000);
      return () => clearTimeout(timer);
    }
  }, [authenticated, account.isConnected]);

  if (isMounted && account?.isConnected) {
    return 'connected' as const;
  }
  if ((authenticated && !hasTimedOut) || isConnecting) {
    return 'pending' as const;
  }
  return 'disconnected' as const;
};

/**
 * Account button: always links straight to /account. The avatar sits on the left with the label
 * stacked beside it — "My account" over the truncated address.
 */
const AccountButton = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { account } = useOceanAccount();
  const { ensName, ensProfile } = useProfileContext();

  const subLabel = ensName || (account.address ? formatWalletAddress(account.address) : '');

  return (
    <Button
      className={classNames(styles.loginButton, styles.accountButton)}
      color="accent1"
      contentBefore={
        account.address ? <Avatar accountId={account.address} size={28} src={ensProfile?.avatar} /> : null
      }
      href="/account"
      onClick={onNavigate}
    >
      <span className={styles.accountLabel}>
        My account
        {subLabel ? <span className={styles.accountAddress}>{subLabel}</span> : null}
      </span>
    </Button>
  );
};

type AccountActionsProps = {
  /** Mobile sidebar: link straight to the account page and expose log out as its own button. */
  asLinks?: boolean;
  /** Called when the slot navigates away or opens the login modal, so the sidebar can close. */
  onNavigate?: () => void;
};

const AccountActions = ({ asLinks, onNavigate }: AccountActionsProps) => {
  const { logout, login } = useOceanAccount();
  const state = useAccountSlotState();

  const handleLogin = () => {
    onNavigate?.();
    login();
  };

  if (state === 'connected') {
    if (!asLinks) {
      return <AccountButton />;
    }
    return (
      <>
        <AccountButton onNavigate={onNavigate} />
        <Button
          autoLoading
          color="accent1"
          contentBefore={<LogoutIcon fontSize="small" />}
          onClick={logout}
          variant="transparent"
        >
          Log out
        </Button>
      </>
    );
  }

  if (state === 'pending') {
    return (
      <Button className={styles.loginButton} color="accent1" disabled>
        <CircularProgress size={16} color="inherit" />
      </Button>
    );
  }

  return (
    <Button className={styles.loginButton} color="accent1" onClick={handleLogin}>
      Log in
    </Button>
  );
};

const SocialLinks = () => (
  <>
    <Button
      className={styles.socialButton}
      color="primary-inverse"
      href={config.socialMedia.discord}
      size="sm-const"
      target="_blank"
      variant="glass"
    >
      <DiscordIcon width={30} height={30} />
    </Button>
    <Button
      className={styles.socialButton}
      color="primary-inverse"
      href={config.socialMedia.twitter}
      size="sm-const"
      target="_blank"
      variant="glass"
    >
      <XIcon width={30} height={30} />
    </Button>
  </>
);

const Navigation = () => {
  const router = useRouter();
  const routes = getRoutes();

  const scrollPositionRef = useRef(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolledBottom, setIsScrolledBottom] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

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
    if (isMenuOpen) {
      scrollPositionRef.current = window.scrollY;
      html.style.overflow = 'hidden';
    } else {
      html.style.overflow = '';
    }
    return () => {
      html.style.overflow = '';
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [router.pathname]);

  const renderNavLinks = (onClick?: () => void) =>
    Object.values(routes).map((route) => {
      if (route.hideFromNavbar) {
        return null;
      }
      const isActive = router.pathname === route.path;
      return (
        <Button
          color={isActive ? 'accent2' : 'primary'}
          key={route.path}
          href={route.path}
          onClick={onClick}
          variant={isActive ? 'filled' : 'transparent'}
        >
          {route.name}
        </Button>
      );
    });

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
          <div className={classNames('chip', 'chipAccent2', styles.betaChip)}>BETA</div>
        </div>
        <Card aria-label="Primary" className={styles.desktopNav} shadow="black" variant="glass-shaded">
          {renderNavLinks()}
        </Card>
        <div className={styles.sideActions}>
          <SocialLinks />
          <AccountActions />
        </div>
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
            onClick={closeMenu}
            size="md-const"
            type="button"
            variant="filled"
          >
            <CloseIcon />
          </Button>
        </div>
        <nav className={styles.mobileNavLinks} aria-label="Mobile primary">
          {renderNavLinks(closeMenu)}
        </nav>
        <div className={styles.mobileActions}>
          <div className={styles.mobileSocials}>
            <SocialLinks />
          </div>
          <AccountActions asLinks onNavigate={closeMenu} />
        </div>
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
