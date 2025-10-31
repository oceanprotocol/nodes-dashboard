import Container from '@/components/container/container';
import SelectResources from '@/components/run-job/select-resources';
import Stepper from '@/components/run-job/stepper';
import SectionTitle from '@/components/section-title/section-title';

const ResourcesPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run a job"
        // TODO: replace with actual subtitle
        subTitle="Select resources description text"
        contentBetween={<Stepper currentStep={2} />}
      />
      <div className="pageContentWrapper">
        <SelectResources />
      </div>
    </Container>
  );
};

export default ResourcesPage;
