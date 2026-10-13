import Claim from '@/components/grant/claim';
import GrantPage from '@/components/grant/grant-page';
import React from 'react';

const ClaimPage: React.FC = () => (
  <GrantPage step="claim">
    <Claim />
  </GrantPage>
);

export default ClaimPage;
