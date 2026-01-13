import Container from '@/components/container/container';
import NodeConfig from '@/components/run-node/node-config';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
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
        title="Run node"
        // TODO: replace with actual subtitle
        subTitle="Description text"
        contentBetween={<Stepper<RunNodeStep> currentStep="configure" steps={getRunNodeSteps()} />}
      />
      {peerId ? (
        <div className="pageContentWrapper">
          <NodeConfig peerId={peerId} />
        </div>
      ) : null}
    </Container>
  );
};

export default ConfigurePage;
