import AuthRequiredPage from '@/components/auth/auth-required-page';
import Container from '@/components/container/container';
import SectionTitle from '@/components/section-title/section-title';
import { getSubsidySteps, SubsidyStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { getProgramSummary } from '@/components/subsidy/subsidy-copy';
import SubsidyStatusError from '@/components/subsidy/subsidy-status-error';
import useSubsidyStepGuard from '@/components/subsidy/use-subsidy-step-guard';
import { useProfileContext } from '@/context/profile-context';
import { useSubsidyProgram } from '@/lib/use-subsidy';
import { CircularProgress } from '@mui/material';
import { ReactNode } from 'react';

type SubsidyPageProps = {
  children: ReactNode;
  step: SubsidyStep;
};

const SubsidyPageContent = ({ children, step }: SubsidyPageProps) => {
  const canRender = useSubsidyStepGuard(step);
  const { subsidyInfo, subsidyInfoError } = useProfileContext();
  const { data: program } = useSubsidyProgram();

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Get a subsidy"
        subTitle={`Verify your email to get ${getProgramSummary(program)} on supported nodes`}
        contentBetween={<Stepper<SubsidyStep> currentStep={step} steps={getSubsidySteps()} />}
      />
      <div className="pageContentWrapper">
        {canRender ? (
          children
        ) : !subsidyInfo && subsidyInfoError ? (
          <SubsidyStatusError />
        ) : (
          <CircularProgress className="alignSelfCenter" />
        )}
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
