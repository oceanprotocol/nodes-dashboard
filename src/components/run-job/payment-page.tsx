import Container from '@/components/container/container';
import Payment from '@/components/run-job/payment';
import Stepper from '@/components/run-job/stepper';
import SectionTitle from '@/components/section-title/section-title';

const PaymentPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        // TODO: replace with actual subtitle
        subTitle="Payment description text"
        contentBetween={<Stepper currentStep={3} />}
      />
      <div className="pageContentWrapper">
        <Payment />
      </div>
    </Container>
  );
};

export default PaymentPage;
