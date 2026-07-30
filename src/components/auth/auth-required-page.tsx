import Button from '@/components/button/button';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Container } from '@mui/material';
import React, { useEffect, useRef } from 'react';
import styles from './auth-required-page.module.css';

type AuthRequiredPage = {
  children?: React.ReactNode;
};

/**
 * A top level component that ensures the user is authenticated when visiting the page passed as children.
 * If the user is not authenticated, it will open the auth modal.
 */
const AuthRequiredPage: React.FC<AuthRequiredPage> = ({ children }) => {
  const { account, isConnecting, login } = useOceanAccount();
  // Fires once per disconnected visit, so no second modal stacks on the first.
  const promptedRef = useRef(false);

  useEffect(() => {
    if (account.isConnected) {
      promptedRef.current = false;
      return;
    }
    // Deep-linking here mounts before the silent reconnect resolves; prompting now would
    // open a modal over a wallet that is about to connect on its own.
    if (isConnecting || promptedRef.current) return;
    promptedRef.current = true;
    login();
  }, [account.isConnected, isConnecting, login]);

  if (isConnecting) {
    return null;
  }

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
