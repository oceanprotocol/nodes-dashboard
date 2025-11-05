import Button from '@/components/button/button';
import Card from '@/components/card/card';
import styles from './profile-header.module.css';

type ProfileHeaderProps = {
  role: 'owner' | 'consumer';
};

const ProfileHeader = ({ role }: ProfileHeaderProps) => {
  return (
    <Card className={styles.root} paddingX="md" paddingY="sm" radius="lg" variant="glass-shaded">
      <div>
        <h2 className={styles.name}>FirstName LastName</h2>
        <div className={styles.address}>0x7097B048A37146aE52A27908Bebd351214C8d8f3</div>
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
