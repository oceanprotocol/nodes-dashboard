import Container from '@/components/container/container';
import Verify from '@/components/grant/verify';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useGrantContext } from '@/context/grant-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const VerifyPage = () => {
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
        subTitle="Complete the verification to receive your grant"
        contentBetween={<Stepper<GrantStep> currentStep="verify" steps={getGrantSteps()} />}
      />
      {grantDetails ? (
        <div className="pageContentWrapper">
          <Verify grantDetails={grantDetails} />
        </div>
      ) : null}
    </Container>
  );
};

export default VerifyPage;
