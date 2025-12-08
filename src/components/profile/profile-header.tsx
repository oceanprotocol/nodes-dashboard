import Avatar from '@/components/avatar/avatar';
import Card from '@/components/card/card';
import TabBar from '@/components/tab-bar/tab-bar';
import { useProfileContext } from '@/context/profile-context';
import { formatWalletAddress } from '@/utils/formatters';
import { useAppKitAccount } from '@reown/appkit/react';
import { useMemo } from 'react';
import styles from './profile-header.module.css';

type ProfileHeaderProps = {
  role: 'owner' | 'consumer';
};

const ProfileHeader = ({ role }: ProfileHeaderProps) => {
  const account = useAppKitAccount();
  const { ensName, ensProfile } = useProfileContext();

  const accountName = useMemo(() => {
    if (account.status === 'connected' && account.address) {
      if (ensName) {
        return ensName;
      }
      if (account.address) {
        return formatWalletAddress(account.address);
      }
    }
    return 'Not connected';
  }, [account, ensName]);

  return (
    <>
      <TabBar
        activeKey={role}
        className={styles.tabBar}
        tabs={[
          {
            href: '/profile/owner',
            key: 'owner',
            label: 'Node owner',
          },
          {
            href: '/profile/consumer',
            key: 'consumer',
            label: 'Compute consumer',
          },
        ]}
      />
      <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
        {account.address ? <Avatar accountId={account.address} size="lg" src={ensProfile?.avatar} /> : null}
        <div>
          <h2 className={styles.name}>{accountName}</h2>
          <div className={styles.address}>{account?.address}</div>
        </div>
      </Card>
    </>
  );
};

export default ProfileHeader;
