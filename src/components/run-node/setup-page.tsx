import Container from '@/components/container/container';
import NodeSetup from '@/components/run-node/node-setup';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const SetupPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run node"
        subTitle="Setup your node, and earn rewards"
        contentBetween={<Stepper<RunNodeStep> currentStep="setup" steps={getRunNodeSteps()} />}
      />
      <div className="pageContentWrapper">
        <NodeSetup />
      </div>
    </Container>
  );
};

export default SetupPage;
