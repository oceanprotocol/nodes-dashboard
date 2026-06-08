import Container from '@/components/container/container';
import NodeConfig from '@/components/run-node/node-config';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import TutorialButton from '@/components/tutorial/tutorial-button';
import { useRunNodeContext } from '@/context/run-node-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ConfigurePage = () => {
  const router = useRouter();

  const { peerId } = useRunNodeContext();

  useEffect(() => {
    if (!peerId) {
      router.replace('/run-node/setup');
    }
  }, [peerId, router]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a node"
        subTitle="Configure resources, settings and other preferences for your node"
        contentBetween={
          <div className="flexRow alignItemsCenter gapSm" data-tutorial="stepper">
            <Stepper<RunNodeStep> currentStep="configure" steps={getRunNodeSteps()} />
            <TutorialButton tutorialId="run-node-flow" currentPage="configure" />
          </div>
        }
        mobileWarning
      />
      {peerId ? (
        <div className="pageContentWrapper">
          <NodeConfig />
        </div>
      ) : null}
    </Container>
  );
};

export default ConfigurePage;
