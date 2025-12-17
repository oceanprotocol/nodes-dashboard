import ConsumerProfilePage from '@/components/profile/consumer.profile-page';
import { MyJobsTableProvider } from '@/context/table/my-jobs-table-context';
import { useAppKitAccount } from '@reown/appkit/react';

const ConsumerProfilePageWrapper: React.FC = () => {
  const account = useAppKitAccount();

  return (
    <MyJobsTableProvider consumer={account?.address}>
      <ConsumerProfilePage />
    </MyJobsTableProvider>
  );
};

export default ConsumerProfilePageWrapper;
