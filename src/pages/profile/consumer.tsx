import ConsumerProfilePage from '@/components/profile/consumer.profile-page';
import { MyJobsTableProvider } from '@/context/table/my-jobs-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';

const ConsumerProfilePageWrapper: React.FC = () => {
  const { account } = useOceanAccount();

  return (
    <MyJobsTableProvider consumer={account.address}>
      <ConsumerProfilePage />
    </MyJobsTableProvider>
  );
};

export default ConsumerProfilePageWrapper;
