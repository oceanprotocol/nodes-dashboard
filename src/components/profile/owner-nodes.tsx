import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { MOCK_NODES } from '@/mock/nodes';
import styles from './owner-nodes.module.css';

const OwnerNodes = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>My nodes</h3>
        <Button color="accent1" href="/run-node">
          Run a node
        </Button>
      </div>
      <Table<Node> autoHeight data={MOCK_NODES} paginationType="none" tableType={TableTypeEnum.MY_NODES} />
    </Card>
  );
};

export default OwnerNodes;
