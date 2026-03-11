import Button from '@/components/button/button';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAuthModal } from '@account-kit/react';
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
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();

  const { account } = useOceanAccount();

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  useEffect(() => {
    if (!account.isConnected) {
      openAuthModal();
    }
  }, [account.isConnected, openAuthModal]);

  if (!account.isConnected) {
    return (
      <Container className="pageRoot">
        <div className={styles.notConnected}>
          <h1>You are not connected</h1>
          <p>Please log in to continue</p>
          <Button className={styles.button} color="accent1" onClick={openAuthModal} size="lg">
            Log in
          </Button>
        </div>
      </Container>
    );
  }

  return children;
};

export default AuthRequiredPage;
