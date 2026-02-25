import Container from '@/components/container/container';
import ConsumerBalance from '@/components/profile/consumer-balance';
import ConsumerJobs from '@/components/profile/consumer-jobs';
import ConsumerStats from '@/components/profile/consumer-stats';
import ProfileHeader from '@/components/profile/profile-header';
import SectionTitle from '@/components/section-title/section-title';

const ConsumerProfilePage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle title="My profile" subTitle="Manage your nodes, jobs, tokens and activity in one place" />
      <div className="pageContentWrapper">
        <ProfileHeader role="consumer" />
        <ConsumerStats />
        <ConsumerBalance />
        <ConsumerJobs />
      </div>
    </Container>
  );
};

export default ConsumerProfilePage;
