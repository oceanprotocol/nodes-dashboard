import Avatar from '@/components/avatar/avatar';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
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
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <div className={styles.nameAndAvatar}>
        {account.address ? <Avatar accountId={account.address} size="lg" src={ensProfile?.avatar} /> : null}
        <div>
          <h2 className={styles.name}>{accountName}</h2>
          <div className={styles.address}>{account?.address}</div>
        </div>
      </div>
      <div className={styles.buttons}>
        <Button color="accent1" href="/profile/owner" size="lg" variant={role === 'owner' ? 'filled' : 'outlined'}>
          Node owner
        </Button>
        <Button
          color="accent1"
          href="/profile/consumer"
          size="lg"
          variant={role === 'consumer' ? 'filled' : 'outlined'}
        >
          Compute consumer
        </Button>
      </div>
    </Card>
  );
};

export default ProfileHeader;
