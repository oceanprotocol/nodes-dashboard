import GrantPage from '@/components/grant/grant-page';
import Verify from '@/components/grant/verify';
import React from 'react';

const VerifyPage: React.FC = () => (
  <GrantPage step="verify">
    <Verify />
  </GrantPage>
);

export default VerifyPage;
