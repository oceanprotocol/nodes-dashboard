import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useGrantContext } from '@/context/grant-context';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';

const ClaimPage: React.FC = () => {
  const router = useRouter();

  const { grantDetails } = useGrantContext();

  useEffect(() => {
    if (!grantDetails) {
      router.push('/grant/details');
    }
  }, [grantDetails, router]);

  if (!grantDetails) return null;

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Grant distribution"
        subTitle="Complete the simple process to receive your grant"
        contentBetween={<Stepper<GrantStep> currentStep="claim" steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        {/* // TODO re-enable grants */}
        {/* <Claim grantDetails={grantDetails} /> */}
      </div>
    </Container>
  );
};

export default ClaimPage;
