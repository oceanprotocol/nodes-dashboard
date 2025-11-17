import Container from '@/components/container/container';
import OwnerNodes from '@/components/profile/owner-nodes';
import OwnerStats from '@/components/profile/owner-stats';
import ProfileHeader from '@/components/profile/profile-header';
import SectionTitle from '@/components/section-title/section-title';

const OwnerProfilePage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="My profile"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className="pageContentWrapper">
        <ProfileHeader role="owner" />
        <OwnerStats />
        <OwnerNodes />
      </div>
    </Container>
  );
};

export default OwnerProfilePage;
