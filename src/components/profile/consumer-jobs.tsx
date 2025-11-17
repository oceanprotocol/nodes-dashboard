import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { MOCK_JOBS } from '@/mock/jobs';
import { Job } from '@/types/jobs';

// TODO context for jobs data for pagination and filtering

const ConsumerJobs = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>My jobs</h3>
      <Table<Job> autoHeight data={MOCK_JOBS} paginationType="none" tableType={TableTypeEnum.MY_JOBS} />
    </Card>
  );
};

export default ConsumerJobs;
