import Container from '@/components/container/container';
import OwnerNodes from '@/components/profile/owner-nodes';
import OwnerStats from '@/components/profile/owner-stats';
import ProfileHeader from '@/components/profile/profile-header';
import SectionTitle from '@/components/section-title/section-title';

const OwnerProfilePage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle title="My profile" subTitle="Manage your nodes, jobs, tokens and activity in one place" />
      <div className="pageContentWrapper">
        <ProfileHeader role="owner" />
        <OwnerStats />
        <OwnerNodes />
      </div>
    </Container>
  );
};

export default OwnerProfilePage;
