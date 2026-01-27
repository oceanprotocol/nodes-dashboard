import Container from '@/components/container/container';
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
        <ConsumerJobs />
      </div>
    </Container>
  );
};

export default ConsumerProfilePage;
