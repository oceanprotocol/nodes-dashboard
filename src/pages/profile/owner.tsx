import OwnerProfilePage from '@/components/profile/owner-profile-page';
import { MyNodesTableContextProvider } from '@/context/table/my-nodes-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';

const OwnerProfilePageWrapper: React.FC = () => {
  const { account } = useOceanAccount();

  return (
    <MyNodesTableContextProvider ownerId={account.address}>
      <OwnerProfilePage />
    </MyNodesTableContextProvider>
  );
};

export default OwnerProfilePageWrapper;
