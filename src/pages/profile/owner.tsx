import OwnerProfilePage from '@/components/profile/owner-profile-page';
import { MyNodesTableContextProvider } from '@/context/table/my-nodes-table-context';
import { useAppKitAccount } from '@reown/appkit/react';

const OwnerProfilePageWrapper: React.FC = () => {
  const account = useAppKitAccount();

  return (
    <MyNodesTableContextProvider ownerId={account?.address}>
      <OwnerProfilePage />
    </MyNodesTableContextProvider>
  );
};

export default OwnerProfilePageWrapper;
