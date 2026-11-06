import Details from '@/components/subsidy/details';
import SubsidyPage from '@/components/subsidy/subsidy-page';
import React from 'react';

const DetailsPage: React.FC = () => (
  <SubsidyPage step="details">
    <Details />
  </SubsidyPage>
);

export default DetailsPage;
