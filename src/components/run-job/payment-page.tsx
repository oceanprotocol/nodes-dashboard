import Container from '@/components/container/container';
import Payment from '@/components/run-job/payment';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const PaymentPage = () => {
  const router = useRouter();

  const { estimatedTotalCost, freeCompute, nodeInfo, selectedEnv, selectedResources, selectedToken } =
    useRunJobContext();

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
        contentBetween={<Stepper<RunJobStep> currentStep="payment" steps={getRunJobSteps(freeCompute)} />}
      />
      {selectedEnv && selectedResources && selectedToken ? (
        <div className="pageContentWrapper">
          <Payment
            selectedEnv={selectedEnv}
            selectedResources={selectedResources}
            selectedToken={selectedToken}
            totalCost={estimatedTotalCost ?? 0}
            peerId={nodeInfo?.id ?? ''}
          />
        </div>
      ) : null}
    </Container>
  );
};

export default PaymentPage;
