import Container from '@/components/container/container';
import SelectEnvironment from '@/components/run-job/select-environment';
import Stepper from '@/components/run-job/stepper';
import SectionTitle from '@/components/section-title/section-title';

const EnvironmentsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run a job"
        // TODO: replace with actual subtitle
        subTitle="Select environment description text"
        contentBetween={<Stepper currentStep={1} />}
      />
      <div className="pageContentWrapper">
        <SelectEnvironment />
      </div>
    </Container>
  );
};

export default EnvironmentsPage;
