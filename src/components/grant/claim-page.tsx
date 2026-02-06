import Container from '@/components/container/container';
import Claim from '@/components/grant/claim';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useGrantContext } from '@/context/grant-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ClaimPage = () => {
  const router = useRouter();

  const { grantDetails } = useGrantContext();

  useEffect(() => {
    if (!grantDetails) {
      router.replace('/grant/details');
    }
  }, [grantDetails, router]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Grant distribution"
        subTitle="Complete the claim process to receive the grant"
        contentBetween={<Stepper<GrantStep> currentStep="claim" steps={getGrantSteps()} />}
      />
      {grantDetails ? (
        <div className="pageContentWrapper">
          <Claim grantDetails={grantDetails} />
        </div>
      ) : null}
    </Container>
  );
};

export default ClaimPage;
