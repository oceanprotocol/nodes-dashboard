import Claim from '@/components/subsidy/claim';
import SubsidyPage from '@/components/subsidy/subsidy-page';
import React from 'react';

const ClaimPage: React.FC = () => (
  <SubsidyPage step="claim">
    <Claim />
  </SubsidyPage>
);

export default ClaimPage;
