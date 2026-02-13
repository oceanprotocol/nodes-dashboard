import Container from '@/components/container/container';
import Claim from '@/components/grant/claim';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const ClaimPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Grant distribution"
        subTitle="Complete the claim process to receive the grant"
        contentBetween={<Stepper<GrantStep> currentStep="claim" steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        <Claim />
      </div>
    </Container>
  );
};

export default ClaimPage;
