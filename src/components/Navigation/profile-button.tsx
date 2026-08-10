import ProfileMenu from '@/components/Navigation/profile-menu';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import Button from '../button/button';
import styles from './navigation.module.css';

const ProfileButton: React.FC = () => {
  const { account, authenticated, isConnecting, login } = useOceanAccount();

  const [isClient, setIsClient] = useState(false);
  const [authSettled, setAuthSettled] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // When authenticated but not yet connected, show a brief spinner.
  // If the wallet doesn't resolve within 4s (stale session), fall back to the login button.
  useEffect(() => {
    if (authenticated && !account.isConnected) {
      setAuthSettled(false);
      const timer = setTimeout(() => setAuthSettled(true), 4000);
      return () => clearTimeout(timer);
    }
    setAuthSettled(false);
  }, [authenticated, account.isConnected]);

  return isClient && account?.isConnected ? (
    <ProfileMenu className={styles.loginButton} />
  ) : (authenticated && !authSettled) || isConnecting ? (
    <Button className={styles.loginButton} color="accent1" disabled>
      <CircularProgress size={16} color="inherit" />
    </Button>
  ) : (
    <Button className={styles.loginButton} color="accent1" onClick={login}>
      Log in
    </Button>
  );
};

export default ProfileButton;
