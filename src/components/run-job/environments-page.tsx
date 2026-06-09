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
        title={
          <div className="flexRow alignItemsStart gapXs">
            <span>Run a job</span>
            <TutorialButton tutorialId="run-job-flow" currentPage="environments" />
          </div>
        }
        subTitle="Choose a compute environment for your workload"
        contentBetween={
          <div data-tutorial="stepper">
            <Stepper<RunJobStep> currentStep="environment" steps={getRunJobSteps(false)} />
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
