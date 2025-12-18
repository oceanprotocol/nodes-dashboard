import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const SetupPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run node"
        // TODO: replace with actual subtitle
        subTitle="Description text"
        contentBetween={<Stepper<RunNodeStep> currentStep="setup" steps={getRunNodeSteps()} />}
      />

      <div className="pageContentWrapper"></div>
    </Container>
  );
};

export default SetupPage;
