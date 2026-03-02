import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useMyNodesTableContext } from '@/context/table/my-nodes-table-context';
import { AnyNode } from '@/types/nodes';
import styles from './owner-nodes.module.css';

const OwnerNodes = () => {
  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>My nodes</h3>
        <Button color="accent1" href="/run-node/setup">
          Run a node
        </Button>
      </div>
      <Table<AnyNode>
        context={useMyNodesTableContext()}
        autoHeight
        paginationType="context"
        showToolbar
        tableType={TableTypeEnum.MY_NODES}
      />
    </Card>
  );
};

export default OwnerNodes;
