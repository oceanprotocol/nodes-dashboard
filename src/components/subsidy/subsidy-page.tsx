import AuthRequiredPage from '@/components/auth/auth-required-page';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import { getSubsidySteps, SubsidyStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import useSubsidyStepGuard from '@/components/subsidy/use-subsidy-step-guard';
import { SUBSIDY_DISCOUNT_PERCENT, SUBSIDY_ONE_TIME_CREDIT, SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { CircularProgress } from '@mui/material';
import { ReactNode } from 'react';

type SubsidyPageProps = {
  children: ReactNode;
  step: SubsidyStep;
};

const SubsidyPageContent = ({ children, step }: SubsidyPageProps) => {
  const canRender = useSubsidyStepGuard(step);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Get a subsidy"
        subTitle={`Verify your email to get ${SUBSIDY_ONE_TIME_CREDIT} ${SUBSIDY_TOKEN_SYMBOL} on us and a ${SUBSIDY_DISCOUNT_PERCENT}% discount on jobs and models`}
        contentBetween={<Stepper<SubsidyStep> currentStep={step} steps={getSubsidySteps()} />}
      />
      <div className="pageContentWrapper">
        {canRender ? children : <CircularProgress className="alignSelfCenter" />}
      </div>
    </Container>
  );
};

const SubsidyPage = (props: SubsidyPageProps) => (
  <AuthRequiredPage>
    <SubsidyPageContent {...props} />
  </AuthRequiredPage>
);

export default SubsidyPage;
