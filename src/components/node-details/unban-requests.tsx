import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { Node } from '@/types';
import { UnbanRequest } from '@/types/unban-requests';
import { useEffect } from 'react';
import styles from './unban-requests.module.css';

type UnbanRequestsProps = {
  node: Node;
};

const UnbanRequests = ({ node }: UnbanRequestsProps) => {
  const { unbanRequests, fetchUnbanRequests } = useUnbanRequestsContext();

  useEffect(() => {
    if (node?.id) {
      fetchUnbanRequests(node.id);
    }
  }, [node?.id, fetchUnbanRequests]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Unban requests</h3>
        <Button color="accent1">Request unban</Button>
      </div>
      <Table<UnbanRequest> data={unbanRequests} paginationType="none" tableType={TableTypeEnum.UNBAN_REQUESTS} />
    </Card>
  );
};

export default UnbanRequests;
