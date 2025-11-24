import Container from '@/components/container/container';
import SelectResources from '@/components/run-job/select-resources';
import Stepper from '@/components/run-job/stepper';
import SectionTitle from '@/components/section-title/section-title';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const ResourcesPage = () => {
  const router = useRouter();

  const { selectedEnv } = useRunJobContext();

  useEffect(() => {
    if (!selectedEnv) {
      router.push('/run-job/environments');
    }
  }, [router, selectedEnv]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        // TODO: replace with actual subtitle
        subTitle="Select resources description text"
        contentBetween={<Stepper currentStep={2} />}
      />
      {selectedEnv ? (
        <div className="pageContentWrapper">
          <SelectResources environment={selectedEnv} />
        </div>
      ) : null}
    </Container>
  );
};

export default ResourcesPage;
