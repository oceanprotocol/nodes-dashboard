import OwnerNodes from '@/components/profile/owner-nodes';
import OwnerServiceStats from '@/components/profile/owner-service-stats';
import OwnerStats from '@/components/profile/owner-stats';
import { MyNodesTableContextProvider } from '@/context/table/my-nodes-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';

const OwnerSection = () => {
  const { account } = useOceanAccount();

  return (
    <MyNodesTableContextProvider ownerId={account.address}>
      <OwnerStats />
      <OwnerServiceStats />
      <OwnerNodes />
    </MyNodesTableContextProvider>
  );
};

export default OwnerSection;
