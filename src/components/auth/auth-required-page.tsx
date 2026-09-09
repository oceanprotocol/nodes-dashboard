import Button from '@/components/button/button';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Container } from '@mui/material';
import React from 'react';
import styles from './auth-required-page.module.css';

type AuthRequiredPage = {
  children?: React.ReactNode;
};

/**
 * Gates a page behind a connected account. Deliberately does not open the login modal on
 * mount: "disconnected" is indistinguishable from "a silent reconnect is still resolving"
 * without a settling signal that has to be correct across effect ordering. Letting the user
 * click removes that whole class of mistimed prompt.
 */
const AuthRequiredPage: React.FC<AuthRequiredPage> = ({ children }) => {
  const { account, login } = useOceanAccount();

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
