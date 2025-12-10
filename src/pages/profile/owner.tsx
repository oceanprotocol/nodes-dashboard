import OwnerProfilePage from '@/components/profile/owner-profile-page';
import { MyNodesTableContextProvider } from '@/context/table/my-nodes-table-context';
import { useParams } from 'next/navigation';

const OwnerProfilePageWrapper: React.FC = () => {
  const params = useParams<{ ownerId: string }>();

  return (
    <MyNodesTableContextProvider ownerId="0xD8264C8CFa74E462B2061207cd186D392130963d">
      <OwnerProfilePage />
    </MyNodesTableContextProvider>
  );
};

export default OwnerProfilePageWrapper;
