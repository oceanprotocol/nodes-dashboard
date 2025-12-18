import Container from '@/components/container/container';
import Payment from '@/components/run-job/payment';
import Stepper from '@/components/run-job/stepper';
import SectionTitle from '@/components/section-title/section-title';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const PaymentPage = () => {
  const router = useRouter();

  const { estimatedTotalCost, freeCompute, selectedEnv, selectedResources, selectedToken } = useRunJobContext();

  useEffect(() => {
    if (!selectedToken) {
      router.replace('/run-job/environments');
    }
  }, [router, selectedToken]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Run job"
        // TODO: replace with actual subtitle
        subTitle="Payment description text"
        contentBetween={<Stepper currentStep={3} freeCompute={freeCompute} />}
      />
      {selectedEnv && selectedResources && selectedToken ? (
        <div className="pageContentWrapper">
          <Payment
            selectedEnv={selectedEnv}
            selectedResources={selectedResources}
            selectedToken={selectedToken}
            totalCost={estimatedTotalCost ?? 0}
          />
        </div>
      ) : null}
    </Container>
  );
};

export default PaymentPage;
