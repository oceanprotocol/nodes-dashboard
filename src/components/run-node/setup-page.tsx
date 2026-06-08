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
        title="Run a node"
        subTitle="Setup your node, and earn rewards"
        contentBetween={
          <div className="flexRow alignItemsCenter gapSm" data-tutorial="stepper">
            <Stepper<RunNodeStep> currentStep="setup" steps={getRunNodeSteps()} />
            <TutorialButton tutorialId="run-node-flow" currentPage="setup" />
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
