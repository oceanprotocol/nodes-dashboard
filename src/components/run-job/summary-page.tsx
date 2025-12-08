import Container from '@/components/container/container';
import Stepper from '@/components/run-job/stepper';
import Summary from '@/components/run-job/summary';
import SectionTitle from '@/components/section-title/section-title';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const SummaryPage = () => {
  const router = useRouter();

  const { estimatedTotalCost, selectedEnv, selectedResources } = useRunJobContext();

  useEffect(() => {
    if (!selectedEnv || !selectedResources) {
      router.replace('/run-job/environments');
    }
  }, [router, selectedEnv, selectedResources]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        subTitle="Everything is set up. Below is a summary of your selection"
        contentBetween={<Stepper currentStep={4} />}
      />
      {selectedEnv && selectedResources ? (
        <div className="pageContentWrapper">
          <Summary
            estimatedTotalCost={estimatedTotalCost ?? 0}
            selectedEnv={selectedEnv}
            selectedResources={selectedResources}
          />
        </div>
      ) : null}
    </Container>
  );
};

export default SummaryPage;
