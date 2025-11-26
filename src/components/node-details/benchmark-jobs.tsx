import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { MOCK_JOBS } from '@/mock/jobs';
import { Job } from '@/types/jobs';

const BenchmarkJobs = () => {
  // TODO implement context for benchmark jobs history to support pagination, sorting, filtering, etc.
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Benchmark jobs history</h3>
      <Table<Job> data={MOCK_JOBS} paginationType="none" tableType={TableTypeEnum.BENCHMARK_JOBS} />
    </Card>
  );
};

export default BenchmarkJobs;
