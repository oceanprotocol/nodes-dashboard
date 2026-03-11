import Container from '@/components/container/container';
import Details from '@/components/grant/details';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import React from 'react';

const DetailsPage: React.FC = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Grant distribution"
        subTitle="Complete the simple process to receive your grant"
        contentBetween={<Stepper<GrantStep> currentStep="details" steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        <Details />
      </div>
    </Container>
  );
};

export default DetailsPage;
