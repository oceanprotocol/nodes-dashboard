import Details from '@/components/grant/details';
import GrantPage from '@/components/grant/grant-page';
import React from 'react';

const DetailsPage: React.FC = () => (
  <GrantPage step="details">
    <Details />
  </GrantPage>
);

export default DetailsPage;
