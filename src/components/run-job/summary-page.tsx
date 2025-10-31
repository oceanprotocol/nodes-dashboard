import Container from '@/components/container/container';
import Stepper from '@/components/run-job/stepper';
import Summary from '@/components/run-job/summary';
import SectionTitle from '@/components/section-title/section-title';

const SummaryPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        subTitle="Everything is set up. Below is a summary of your selection"
        contentBetween={<Stepper currentStep={4} />}
      />
      <div className="pageContentWrapper">
        <Summary />
      </div>
    </Container>
  );
};

export default SummaryPage;
