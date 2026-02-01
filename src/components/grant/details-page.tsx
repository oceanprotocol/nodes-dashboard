import Container from '@/components/container/container';
import Details from '@/components/grant/details';
import SectionTitle from '@/components/section-title/section-title';
import { getGrantSteps, GrantStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';

const DetailsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Grant distribution"
        subTitle="Fill in the details below to receive your grant"
        contentBetween={<Stepper<GrantStep> currentStep="details" steps={getGrantSteps()} />}
      />
      <div className="pageContentWrapper">
        <Details />
      </div>
    </Container>
  );
};

export default DetailsPage;
