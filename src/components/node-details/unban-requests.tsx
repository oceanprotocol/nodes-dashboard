import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { MOCK_JOBS } from '@/mock/jobs';
import { Job } from '@/types/jobs';
import styles from './unban-requests.module.css';

const UnbanRequests = () => {
  // TODO implement context for unban requests to support pagination, sorting, filtering, etc.
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Unban requests</h3>
        <Button color="accent1">Request unban</Button>
      </div>
      <Table<Job> data={MOCK_JOBS} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
    </Card>
  );
};

export default UnbanRequests;
