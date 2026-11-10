import SubsidyPage from '@/components/subsidy/subsidy-page';
import Verify from '@/components/subsidy/verify';
import React from 'react';

const VerifyPage: React.FC = () => (
  <SubsidyPage step="verify">
    <Verify />
  </SubsidyPage>
);

export default VerifyPage;
