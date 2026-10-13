import AuthRequiredPage from '@/components/auth/auth-required-page';
import FiatTopupPage from '@/components/dev/fiat-topup-page';
import React from 'react';

// Card top-up test page: not linked from the app, but reachable by URL for any logged-in user.
const FiatTopupPageWrapper: React.FC = () => {
  return (
    <AuthRequiredPage>
      <FiatTopupPage />
    </AuthRequiredPage>
  );
};

export default FiatTopupPageWrapper;
