import ExistingServicesTable from '@/components/inference/existing-services-table';
import ConsumerBalance from '@/components/profile/consumer-balance';
import ConsumerJobs from '@/components/profile/consumer-jobs';
import ConsumerServiceStats from '@/components/profile/consumer-service-stats';
import ConsumerStats from '@/components/profile/consumer-stats';
import { MyJobsTableProvider } from '@/context/table/my-jobs-table-context';
import { useOceanAccount } from '@/lib/use-ocean-account';

const ConsumerSection = () => {
  const { account } = useOceanAccount();

  return (
    <MyJobsTableProvider consumer={account.address}>
      <ConsumerStats />
      <ConsumerServiceStats />
      <ConsumerBalance />
      <ConsumerJobs />
      <ExistingServicesTable />
    </MyJobsTableProvider>
  );
};

export default ConsumerSection;
