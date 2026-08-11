import ConsumerBalance from '@/components/profile/consumer-balance';
import ConsumerJobs from '@/components/profile/consumer-jobs';
import ConsumerStats from '@/components/profile/consumer-stats';
import { MyJobsTableProvider } from '@/context/table/my-jobs-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';

const ConsumerSection = () => {
  const { account } = useOceanAccount();

  return (
    <MyJobsTableProvider consumer={account.address}>
      <ConsumerStats />
      <ConsumerBalance />
      <ConsumerJobs />
    </MyJobsTableProvider>
  );
};

export default ConsumerSection;
