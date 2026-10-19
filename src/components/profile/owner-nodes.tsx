import Button from '@/components/button/button';
import Card from '@/components/card/card';
import NodeLookupModal from '@/components/modal/node-lookup-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useMyNodesTableContext } from '@/context/table/my-nodes-table-context';
import { useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { rememberAddedNodeId } from '@/services/added-nodes-memory';
import { findNode } from '@/services/node-lookup';
import { AnyNode } from '@/types/nodes';
import { fetchNodeAdmins, isNodeAdmin } from '@/utils/node-admin';
import { useState } from 'react';
import styles from './owner-nodes.module.css';

const OwnerNodes = () => {
  const { account } = useOceanAccount();
  const { isReady: isP2PReady, sendCommand } = useP2P();
  const tableContext = useMyNodesTableContext();

  const [addOpen, setAddOpen] = useState(false);

  const handleAddNode = async (idOrName: string): Promise<string | null> => {
    if (!account.address) {
      return 'Connect your wallet to add a node';
    }
    const node = await findNode(idOrName);
    if (!node?.id) {
      return 'Node not found';
    }
    const admins = await fetchNodeAdmins({ currentAddrs: node.currentAddrs, isP2PReady, nodeId: node.id, sendCommand });
    if (!(await isNodeAdmin(admins, account.address))) {
      return 'Your wallet is not an admin of this node';
    }
    rememberAddedNodeId(account.address, node.id);
    await tableContext.fetchData();
    return null;
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <NodeLookupModal
        description="Not seeing a node you admin? Enter its node ID or friendly name below."
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddNode}
        submitLabel="Add node"
        title="Add node"
      />
      <div className={styles.header}>
        <h3>My nodes</h3>
        <div className={styles.headerActions}>
          <Button color="accent1" onClick={() => setAddOpen(true)} variant="transparent">
            Add node
          </Button>
          <Button color="accent1" href="/run-node/setup">
            Run a node
          </Button>
        </div>
      </div>
      <Table<AnyNode>
        context={tableContext}
        autoHeight
        paginationType="context"
        showToolbar
        tableType={TableTypeEnum.MY_NODES}
      />
    </Card>
  );
};

export default OwnerNodes;
