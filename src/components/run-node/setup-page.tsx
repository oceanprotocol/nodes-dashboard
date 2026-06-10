import Container from '@/components/container/container';
import NodeSetup from '@/components/run-node/node-setup';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import TutorialButton from '@/components/tutorial/tutorial-button';

const SetupPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title={
          <div className="flexRow alignItemsStart gapXs">
            <span>Run a node</span>
            <TutorialButton tutorialId="run-node-flow" currentPage="setup" />
          </div>
        }
        subTitle="Setup your node, and earn rewards"
        contentBetween={
          <div data-tutorial="stepper">
            <Stepper<RunNodeStep> currentStep="setup" steps={getRunNodeSteps()} />
          </div>
        }
        mobileWarning
      />
      <div className="pageContentWrapper">
        <NodeSetup />
      </div>
    </Container>
  );
};

export default SetupPage;
