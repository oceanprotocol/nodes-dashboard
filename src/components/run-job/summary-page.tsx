import Container from '@/components/container/container';
import Summary from '@/components/run-job/summary';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import TutorialButton from '@/components/tutorial/tutorial-button';
import { useRunJobContext } from '@/context/run-job-context';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const SummaryPage = () => {
  const router = useRouter();

  const {
    estimatedTotalCost,
    freeCompute,
    hydrateFromUrlFinished,
    nodeInfo,
    selectedEnv,
    selectedResources,
    selectedToken,
  } = useRunJobContext();

  useEffect(() => {
    if (hydrateFromUrlFinished) {
      if (!selectedEnv || !selectedResources) {
        router.replace('/run-job/environments');
      }
    }
  }, [hydrateFromUrlFinished, router, selectedEnv, selectedResources]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle={
          hydrateFromUrlFinished ? (
            'Everything is set up. Below is a summary of your selection'
          ) : (
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Retrieving your preferences...</span>
            </div>
          )
        }
        contentBetween={
          <div className="flexRow alignItemsCenter gapSm" data-tutorial="stepper">
            <Stepper<RunJobStep> currentStep="finish" steps={getRunJobSteps(freeCompute)} />
            <TutorialButton tutorialId="run-job-flow" currentPage="summary" />
          </div>
        }
        mobileWarning
      />
      {hydrateFromUrlFinished && nodeInfo && selectedEnv && selectedResources && (freeCompute || selectedToken) ? (
        <div className="pageContentWrapper" data-tutorial="summary-review">
          <Summary
            estimatedTotalCost={estimatedTotalCost ?? 0}
            freeCompute={freeCompute}
            nodeInfo={nodeInfo}
            selectedEnv={selectedEnv}
            selectedResources={selectedResources}
            token={selectedToken ?? null}
          />
        </div>
      ) : null}
    </Container>
  );
};

export default SummaryPage;
