import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import {
  BenchmarkJobsHistoryTableProvider,
  useBenchmarkJobsHistoryTableContext,
} from '@/context/table/benchmark-jobs-history-table-context';
import { BenchmarkJobHistory } from '@/types/jobs';
import { useParams } from 'next/navigation';

const BenchmarkJobsContent = () => {
  const benchmarkJobsHistoryTableContext = useBenchmarkJobsHistoryTableContext();

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Benchmark jobs history</h3>
      <Table<BenchmarkJobHistory>
        context={benchmarkJobsHistoryTableContext}
        paginationType="context"
        showToolbar
        tableType={TableTypeEnum.BENCHMARK_JOBS}
      />
    </Card>
  );
};

const BenchmarkJobs = () => {
  const params = useParams<{ nodeId: string }>();

  if (!params?.nodeId) {
    return null;
  }

  return (
    <BenchmarkJobsHistoryTableProvider nodeId={params.nodeId}>
      <BenchmarkJobsContent />
    </BenchmarkJobsHistoryTableProvider>
  );
};

export default BenchmarkJobs;
