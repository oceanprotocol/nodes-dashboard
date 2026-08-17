import AccountIdentity from '@/components/account/account-identity';
import { ACCOUNT_SECTIONS, AccountItem, AccountSectionKey } from '@/components/account/account-sections';
import Card from '@/components/card/card';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useTheme, type ThemePreference } from '@/lib/use-theme';
import { GrantStatus } from '@/types/grant';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { Collapse, useMediaQuery } from '@mui/material';
import classNames from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import styles from './account-nav.module.css';

/** Matches the `min-width: 940px` breakpoint the account layout and this card use in CSS. */
const DESKTOP_QUERY = '(min-width: 768px)';

type AccountNavProps = {
  activeKey: AccountSectionKey;
  className?: string;
};

const THEME_OPTIONS: { icon: React.ReactNode; label: string; value: ThemePreference }[] = [
  { icon: <LightModeIcon />, label: 'Light', value: 'light' },
  { icon: <SettingsBrightnessIcon />, label: 'System', value: 'system' },
  { icon: <DarkModeIcon />, label: 'Dark', value: 'dark' },
];

const AccountNav = ({ activeKey, className }: AccountNavProps) => {
  const { logout, provider } = useOceanAccount();
  const { grantStatus } = useProfileContext();
  const { preference, setPreference } = useTheme();
  const router = useRouter();

  // Defaults to true so the server render and the desktop layout both show the full menu;
  // on mobile the query resolves to false after mount and the menu collapses behind the toggle.
  const isDesktop = useMediaQuery(DESKTOP_QUERY, { defaultMatches: true });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isExpanded = isDesktop || isMobileOpen;

  const isAvailable = (item: AccountItem) => {
    if (item.requires === 'provider') {
      return !!provider;
    }
    if (item.requires === 'grant-unclaimed') {
      return grantStatus !== GrantStatus.CLAIMED;
    }
    return true;
  };

  const visibleItems = ACCOUNT_SECTIONS.filter(isAvailable);

  // The account pages need a connected wallet, so leave for the homepage once the session is gone.
  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <Card
      className={classNames(styles.root, className)}
      direction="column"
      padding="xs"
      radius="lg"
      shadow="black"
      spacing="sm"
      variant="glass-shaded"
    >
      <AccountIdentity />

      {!isDesktop ? (
        <button
          aria-controls="account-nav-menu"
          aria-expanded={isMobileOpen}
          aria-label="My account menu"
          className={classNames(styles.item, styles.toggle)}
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          type="button"
        >
          <span className={styles.itemIcon}>
            <MenuIcon />
          </span>
          <span className={styles.itemLabel}>Account menu</span>
          <ExpandMoreIcon className={classNames(styles.toggleIcon, { [styles.toggleIconOpen]: isMobileOpen })} />
        </button>
      ) : null}

      <Collapse in={isExpanded} unmountOnExit>
        <div className={styles.menu} id="account-nav-menu">
          <nav aria-label="My account" className={styles.nav}>
            {visibleItems.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={classNames(styles.item, { [styles.itemActive]: isActive })}
                  href={item.href}
                  key={item.key}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.linksOut ? <NorthEastIcon className={styles.itemLinksOut} /> : null}
                </Link>
              );
            })}
          </nav>

          <button className={classNames(styles.item, styles.logout)} onClick={handleLogout} type="button">
            <span className={styles.itemIcon}>
              <LogoutIcon />
            </span>
            <span className={styles.itemLabel}>Log out</span>
          </button>

          <div aria-label="Theme" className={styles.theme} role="radiogroup">
            {THEME_OPTIONS.map((option) => {
              const isSelected = option.value === preference;
              return (
                <button
                  aria-checked={isSelected}
                  className={classNames(styles.themeOption, { [styles.themeOptionActive]: isSelected })}
                  key={option.value}
                  onClick={() => setPreference(option.value)}
                  role="radio"
                  title={option.label}
                  type="button"
                >
                  {option.icon}
                  <span className={styles.themeOptionLabel}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Collapse>
    </Card>
  );
};

export default AccountNav;
