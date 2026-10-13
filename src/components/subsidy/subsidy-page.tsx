import AuthRequiredPage from '@/components/auth/auth-required-page';
import Container from '@/components/container/container';
import useGrantStepGuard from '@/components/grant/use-grant-step-guard';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { SUBSIDY_DISCOUNT_PERCENT, SUBSIDY_ONE_TIME_CREDIT, SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { CircularProgress } from '@mui/material';
import { ReactNode } from 'react';

type GrantPageProps = {
  children: ReactNode;
  step: GrantStep;
};

const GrantPageContent = ({ children, step }: GrantPageProps) => {
  const canRender = useGrantStepGuard(step);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Get a subsidy"
        subTitle={`Verify your email to get ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us and a ${SUBSIDY_DISCOUNT_PERCENT}% discount on jobs and models`}
        contentBetween={<Stepper<GrantStep> currentStep={step} steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        {canRender ? children : <CircularProgress className="alignSelfCenter" />}
      </div>
    </Container>
  );
};

const GrantPage = (props: GrantPageProps) => (
  <AuthRequiredPage>
    <GrantPageContent {...props} />
  </AuthRequiredPage>
);

export default GrantPage;
