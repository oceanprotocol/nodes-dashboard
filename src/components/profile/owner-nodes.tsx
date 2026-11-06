import Button from '@/components/button/button';
import Card from '@/components/card/card';
import LookupModal from '@/components/modal/lookup-modal';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { getApiRoute } from '@/config';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { recallAddedNodeIds, rememberAddedNodeId } from '@/services/added-nodes-memory';
import { fetchNodesByIds, findNode } from '@/services/node-lookup';
import { AnyNode, Node } from '@/types/nodes';
import { isNodeAdmin, toNodeAdminAccessLists } from '@/utils/node-admin';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import styles from './owner-nodes.module.css';

const MY_NODES_LIMIT = 1000;

const fetchMyNodes = async (owner: string): Promise<Node[]> => {
  const [adminResponse, addedNodes] = await Promise.all([
    axios.get<{ nodes: Node[] }>(`${getApiRoute('admin')}/${owner}/myNodes`, {
      params: { size: MY_NODES_LIMIT, sort: JSON.stringify({ totalScore: 'desc' }) },
    }),
    fetchNodesByIds(recallAddedNodeIds(owner)).catch((error) => {
      console.error('Failed to fetch added nodes:', error);
      return [] as Node[];
    }),
  ]);
  const adminNodes = adminResponse.data.nodes;
  const listedIds = new Set(adminNodes.map((node) => node.id));
  return [...adminNodes, ...addedNodes.filter((node) => !listedIds.has(node.id))].map((node, index) => ({
    ...node,
    index: index + 1,
  }));
};

const OwnerNodes = () => {
  const { account } = useOceanAccount();

  const [addOpen, setAddOpen] = useState(false);

  const myNodesQuery = useQuery({
    queryKey: ['my-nodes', account.address],
    enabled: !!account.address,
    queryFn: () => (account.address ? fetchMyNodes(account.address) : []),
  });

  const handleAddNode = async (idOrName: string): Promise<string | null> => {
    if (!account.address) {
      return 'Connect your wallet to add a node';
    }
    const node = await findNode(idOrName);
    if (!node?.id) {
      return 'Node not found';
    }
    const admins = { addresses: node.allowedAdmins, accessLists: toNodeAdminAccessLists(node.adminAccessLists) };
    if (!(await isNodeAdmin(admins, account.address))) {
      return 'Your wallet is not an admin of this node';
    }
    rememberAddedNodeId(account.address, node.id);
    await myNodesQuery.refetch();
    return null;
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <LookupModal
        description="Not seeing a node you admin? Enter its node ID or friendly name below."
        isOpen={addOpen}
        label="Node ID or friendly name"
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
        autoHeight
        data={myNodesQuery.data ?? []}
        loading={myNodesQuery.isFetching}
        paginationType="none"
        tableType={TableTypeEnum.MY_NODES}
      />
    </Card>
  );
};

export default OwnerNodes;
