import Button from '@/components/button/button';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { usePrivy } from '@privy-io/react-auth';
import { Container } from '@mui/material';
import React, { useEffect } from 'react';
import styles from './auth-required-page.module.css';

type AuthRequiredPage = {
  children?: React.ReactNode;
};

/**
 * A top level component that ensures the user is authenticated when visiting the page passed as children.
 * If the user is not authenticated, it will open the auth modal.
 */
const AuthRequiredPage: React.FC<AuthRequiredPage> = ({ children }) => {
  const { login } = usePrivy();

  const { account } = useOceanAccount();

  useEffect(() => {
    if (!account.isConnected) {
      login();
    }
  }, [account.isConnected, login]);

  if (!account.isConnected) {
    return (
      <Container className="pageRoot">
        <div className={styles.notConnected}>
          <h1>You are not connected</h1>
          <p>Please log in to continue</p>
          <Button className={styles.button} color="accent1" onClick={login} size="lg">
            Log in
          </Button>
        </div>
      </Container>
    );
  }

  return children;
};

export default AuthRequiredPage;
