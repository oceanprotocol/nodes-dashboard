import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useMyJobsTableContext } from '@/context/table/my-jobs-table-context';
import { Job } from '@/types/jobs';

const ConsumerJobs = () => {
  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>My jobs</h3>
      <Table<Job>
        context={useMyJobsTableContext()}
        autoHeight
        showToolbar
        paginationType="context"
        tableType={TableTypeEnum.MY_JOBS}
      />
    </Card>
  );
};

export default ConsumerJobs;
