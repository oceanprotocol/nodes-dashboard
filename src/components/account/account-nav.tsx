import AccountIdentity from '@/components/account/account-identity';
import {
  ACCOUNT_GROUPS,
  ACCOUNT_SECTIONS,
  AccountItem,
  AccountSectionKey,
} from '@/components/account/account-sections';
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
      padding="sm"
      radius="lg"
      shadow="black"
      spacing="sm"
      variant="glass-shaded"
    >
      <span className={styles.eyebrow}>My account</span>
      <AccountIdentity />
      <nav aria-label="My account" className={styles.nav}>
        {ACCOUNT_GROUPS.map((group) => {
          const items = visibleItems.filter((item) => item.group === group.key);
          if (items.length === 0) {
            return null;
          }
          return (
            <div className={styles.group} key={group.key}>
              <h2 className={styles.groupLabel}>{group.label}</h2>
              <ul className={styles.items}>
                {items.map((item) => {
                  const isActive = item.key === activeKey;
                  return (
                    <li key={item.key}>
                      <Link
                        aria-current={isActive ? 'page' : undefined}
                        className={classNames(styles.item, { [styles.itemActive]: isActive })}
                        href={item.href}
                      >
                        <span className={styles.itemIcon}>{item.icon}</span>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.linksOut ? <NorthEastIcon className={styles.itemLinksOut} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
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
