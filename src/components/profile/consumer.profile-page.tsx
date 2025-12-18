import Container from '@/components/container/container';
import ConsumerEnvironments from '@/components/profile/consumer-environments';
import ConsumerJobs from '@/components/profile/consumer-jobs';
import ConsumerStats from '@/components/profile/consumer-stats';
import ProfileHeader from '@/components/profile/profile-header';
import SectionTitle from '@/components/section-title/section-title';

const ConsumerProfilePage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="My profile"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className="pageContentWrapper">
        <ProfileHeader role="consumer" />
        <ConsumerStats />
        <ConsumerEnvironments />
        <ConsumerJobs />
      </div>
    </Container>
  );
};

export default ConsumerProfilePage;
