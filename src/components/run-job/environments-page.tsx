import Container from '@/components/container/container';
import SelectEnvironment from '@/components/run-job/select-environment';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const EnvironmentsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        // TODO: replace with actual subtitle
        subTitle="Select environment description text"
        contentBetween={<Stepper<RunJobStep> currentStep="environment" steps={getRunJobSteps(false)} />}
      />
      <div className="pageContentWrapper">
        <SelectEnvironment />
      </div>
    </Container>
  );
};

export default EnvironmentsPage;
