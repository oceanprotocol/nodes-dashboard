import Container from '@/components/container/container';
import Verify from '@/components/grant/verify';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const VerifyPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Grant distribution"
        subTitle="Complete the verification to receive your grant"
        contentBetween={<Stepper<GrantStep> currentStep="verify" steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        <Verify />
      </div>
    </Container>
  );
};

export default VerifyPage;
