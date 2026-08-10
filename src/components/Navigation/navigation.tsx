import DiscordIcon from '@/assets/discord.svg';
import Logo from '@/assets/logo.svg';
import XIcon from '@/assets/x.svg';
import AccountIdentity from '@/components/account/account-identity';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Menu from '@/components/menu/menu';
import { useOceanAccount } from '@/lib/use-ocean-account';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { CircularProgress, ListItemIcon, MenuItem, styled } from '@mui/material';
import { default as classNames, default as cx } from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ElementType, useEffect, useRef, useState } from 'react';
import config, { getRoutes } from '../../config';
import Container from '../container/container';
import styles from './navigation.module.css';

// The identity plate reads as the header of the panel, so it keeps the divider and the wider padding
// while the actions below sit on the tighter menu rhythm.
const IdentityHeader = styled('div')({
  borderBottom: '1px solid var(--border-glass)',
  marginBottom: 6,
  padding: '6px 10px 12px',
});

// styled() drops MenuItem's polymorphic typing, so the `component`/`href` pair is re-declared here.
const StyledMenuItem = styled(MenuItem)<{ component?: ElementType; href?: string }>({
  borderRadius: 12,
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 14,
  fontWeight: 600,
  gap: 8,
  minHeight: 0,
  padding: '8px 10px',

  '&:hover': {
    backgroundColor: 'var(--background-glass-secondary)',
  },

  '&:focus-visible': {
    outline: '2px solid var(--accent1)',
    outlineOffset: -2,
  },

  '& .MuiListItemIcon-root': {
    color: 'var(--text-secondary)',
    minWidth: 0,
  },
});

const LogoutMenuItem = styled(StyledMenuItem)({
  color: 'var(--error-darker)',

  '& .MuiListItemIcon-root': {
    color: 'var(--error-darker)',
  },
});

const Chevron = styled(ExpandMoreIcon, { shouldForwardProp: (prop) => prop !== 'is_open' })<{ is_open?: boolean }>(
  ({ is_open }) => ({
    fontSize: 18,
    transform: is_open ? 'rotate(180deg)' : 'rotate(0)',
    transition: 'transform 0.2s ease',
  })
);

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

/** Desktop account slot: a button that opens the account dropdown. */
const AccountMenu = () => {
  const { logout } = useOceanAccount();

  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isOpen = !!anchor;

  const closeMenu = () => setAnchor(null);

  const handleLogout = async () => {
    closeMenu();
    await logout();
  };

  return (
    <>
      <Button
        aria-controls={isOpen ? 'profile-menu' : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={styles.loginButton}
        color="accent1"
        contentAfter={<Chevron is_open={isOpen} />}
        id="profile-button"
        onClick={() => setAnchor(buttonRef.current)}
        ref={buttonRef}
      >
        My account
      </Button>
      <Menu
        anchorEl={anchor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        id="profile-menu"
        onClose={closeMenu}
        open={isOpen}
        slotProps={{
          list: { 'aria-labelledby': 'profile-button', sx: { padding: 1, minWidth: 264 } },
        }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <IdentityHeader>
          <AccountIdentity />
        </IdentityHeader>
        <StyledMenuItem component={Link} disableRipple href="/account" onClick={closeMenu}>
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          My account
        </StyledMenuItem>
        <LogoutMenuItem disableRipple onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </LogoutMenuItem>
      </Menu>
    </>
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
      return <AccountMenu />;
    }
    return (
      <>
        <Button
          className={styles.loginButton}
          color="accent1"
          contentBefore={<PersonOutlineIcon fontSize="small" />}
          href="/account"
          onClick={onNavigate}
        >
          My account
        </Button>
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
