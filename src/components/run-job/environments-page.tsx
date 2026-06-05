import Container from '@/components/container/container';
import SelectEnvironment from '@/components/run-job/select-environment';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import TutorialButton from '@/components/tutorial/tutorial-button';

const EnvironmentsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle="Choose a compute environment for your workload"
        contentBetween={
          <div className="flexRow alignItemsCenter gapSm" data-tutorial="stepper">
            <Stepper<RunJobStep> currentStep="environment" steps={getRunJobSteps(false)} />
            <TutorialButton tutorialId="run-job-flow" currentPage="environments" />
          </div>
        }
        mobileWarning
      />
      <div className="pageContentWrapper" data-tutorial="environment-list">
        <SelectEnvironment />
      </div>
    </Container>
  );
};

export default EnvironmentsPage;
