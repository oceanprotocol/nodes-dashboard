import Container from '@/components/container/container';
import SelectResources from '@/components/run-job/select-resources';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useRunJobContext } from '@/context/run-job-context';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ResourcesPage = () => {
  const router = useRouter();

  const { freeCompute, hydrateFromUrlFinished, selectedEnv, selectedToken } = useRunJobContext();

  useEffect(() => {
    if (hydrateFromUrlFinished) {
      if (!selectedEnv || (!freeCompute && !selectedToken)) {
        router.replace('/run-job/environments');
      }
    }
  }, [router, selectedEnv, selectedToken, freeCompute, hydrateFromUrlFinished]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle={
          hydrateFromUrlFinished ? (
            'Pick the resources you need for your job'
          ) : (
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Retrieving your preferences...</span>
            </div>
          )
        }
        contentBetween={<Stepper<RunJobStep> currentStep="resources" steps={getRunJobSteps(freeCompute)} />}
        mobileWarning
      />
      {hydrateFromUrlFinished && selectedEnv && (freeCompute || selectedToken) ? (
        <div className="pageContentWrapper">
          <SelectResources environment={selectedEnv} freeCompute={freeCompute} token={selectedToken ?? null} />
        </div>
      ) : null}
    </Container>
  );
};

export default ResourcesPage;
