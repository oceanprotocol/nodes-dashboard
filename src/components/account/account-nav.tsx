import AccountIdentity from '@/components/account/account-identity';
import { ACCOUNT_SECTIONS, AccountItem, AccountSectionKey } from '@/components/account/account-sections';
import Card from '@/components/card/card';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantStatus } from '@/types/grant';
import LogoutIcon from '@mui/icons-material/Logout';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import classNames from 'classnames';
import Link from 'next/link';
import styles from './account-nav.module.css';

type AccountNavProps = {
  activeKey: AccountSectionKey;
};

const AccountNav = ({ activeKey }: AccountNavProps) => {
  const { logout, provider } = useOceanAccount();
  const { grantStatus } = useProfileContext();

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

  return (
    <Card
      className={styles.root}
      direction="column"
      padding="xs"
      radius="lg"
      shadow="black"
      spacing="sm"
      variant="glass-shaded"
    >
      <AccountIdentity />
      <nav aria-label="My account" className={styles.nav}>
        {ACCOUNT_SECTIONS.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={classNames(styles.item, { [styles.itemActive]: isActive })}
              href={item.href}
              key={item.key}
            >
              <span className={styles.itemIcon}>{item.icon}</span>
              <span className={styles.itemLabel}>{item.label}</span>
              {item.linksOut ? <NorthEastIcon className={styles.itemLinksOut} /> : null}
            </Link>
          );
        })}
      </nav>
      <button className={classNames(styles.item, styles.logout)} onClick={logout} type="button">
        <span className={styles.itemIcon}>
          <LogoutIcon />
        </span>
        <span className={styles.itemLabel}>Log out</span>
      </button>
    </Card>
  );
};

export default AccountNav;
