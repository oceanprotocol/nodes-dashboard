import Container from '@/components/container/container';
import SelectResources from '@/components/run-job/select-resources';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ResourcesPage = () => {
  const router = useRouter();

  const { freeCompute, selectedEnv, selectedToken } = useRunJobContext();

  useEffect(() => {
    if (!selectedEnv || (!freeCompute && !selectedToken)) {
      router.replace('/run-job/environments');
    }
  }, [router, selectedEnv, selectedToken, freeCompute]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle="Pick the resources you need for your job"
        contentBetween={<Stepper<RunJobStep> currentStep="resources" steps={getRunJobSteps(freeCompute)} />}
      />
      {selectedEnv && (freeCompute || selectedToken) ? (
        <div className="pageContentWrapper">
          <SelectResources environment={selectedEnv} freeCompute={freeCompute} token={selectedToken ?? null} />
        </div>
      ) : null}
    </Container>
  );
};

export default ResourcesPage;
