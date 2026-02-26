import Container from '@/components/container/container';
import Payment from '@/components/run-job/payment';
import SectionTitle from '@/components/section-title/section-title';
import { getRunJobSteps, RunJobStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useRunJobContext } from '@/context/run-job-context';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const PaymentPage = () => {
  const router = useRouter();

  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);

  const { estimatedTotalCost, freeCompute, minLockSeconds, selectedEnv, selectedResources, selectedToken } =
    useRunJobContext();

  useEffect(() => {
    if (!selectedToken) {
      router.replace('/run-job/environments');
    }
  }, [router, selectedToken]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a job"
        subTitle={subtitle}
        contentBetween={<Stepper<RunJobStep> currentStep="payment" steps={getRunJobSteps(freeCompute)} />}
      />
      {selectedEnv && selectedResources && selectedToken ? (
        <div className="pageContentWrapper">
          <Payment
            minLockSeconds={minLockSeconds ?? 0}
            selectedEnv={selectedEnv}
            selectedResources={selectedResources}
            selectedToken={selectedToken}
            setPageSubtitle={setSubtitle}
            totalCost={estimatedTotalCost ?? 0}
          />
        </div>
      ) : null}
    </Container>
  );
};

export default PaymentPage;
