import NodeDetailsPageLayout from '@/components/node-details/node-details-page-layout';
import MyBuckets from '@/components/node-storage/my-buckets';
import { useNodesContext } from '@/context/nodes-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

const NodeStoragePage: React.FC = () => {
  const params = useParams<{ nodeId: string }>();

  const { account } = useOceanAccount();

  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();

  const node = useMemo(() => {
    if (params?.nodeId === selectedNode?.id || params?.nodeId === selectedNode?.nodeId) {
      return selectedNode;
    }
    return null;
  }, [params?.nodeId, selectedNode]);

  useEffect(() => {
    if (!node) {
      fetchNode(params?.nodeId);
    }
  }, [params?.nodeId, fetchNode, node]);

  return (
    <NodeDetailsPageLayout
      activeTab="storage"
      isWalletConnected={account.isConnected}
      loading={loadingFetchNode}
      nodeId={params?.nodeId}
      subtitle="Manage your storage buckets on the node"
    >
      {node ? <MyBuckets node={node} /> : null}
    </NodeDetailsPageLayout>
  );
};

export default NodeStoragePage;
