import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeDetailsPageLayout from '@/components/node-details/node-details-page-layout';
import NodeInfo from '@/components/node-details/node-info';
import UnbanRequests from '@/components/node-details/unban-requests';
import { useNodesContext } from '@/context/nodes-context';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { useP2P } from '@/contexts/P2PContext';
import { directNodeCommand } from '@/lib/direct-node-command';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const NodeDetailsPage: React.FC = () => {
  const params = useParams<{ nodeId: string }>();

  const { account } = useOceanAccount();

  const { getEnvs: getEnvsP2P, isReady: isP2PReady, sendCommand } = useP2P();

  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();
  const { unbanRequests, fetchUnbanRequests } = useUnbanRequestsContext();

  const [connectedP2P, setConnectedP2P] = useState<boolean | null>(null);
  const [connectedDirectNodeCommand, setConnectedDirectNodeCommand] = useState<boolean | null>(null);
  const [nodeEnvs, setNodeEnvs] = useState<ComputeEnvironment[]>([]);

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

  /**
   * Check node connectivity by p2p and direct node command by loading its envs
   */
  useEffect(() => {
    if (!node) {
      return;
    }
    const peerId = node.id ?? node.nodeId;
    if (isP2PReady) {
      getEnvsP2P(node.currentAddrs?.length ? node.currentAddrs : peerId)
        .then((envs) => {
          setNodeEnvs((prev) => (prev.length > 0 ? prev : envs));
          setConnectedP2P(true);
        })
        .catch(() => setConnectedP2P(false));
    }
    directNodeCommand({
      command: 'getComputeEnvironments',
      body: {},
      multiaddrs: node.currentAddrs,
      peerId,
    })
      .then(async (response) => {
        try {
          const envs = await response.json();
          setNodeEnvs((prev) => (prev.length > 0 ? prev : envs));
          setConnectedDirectNodeCommand(true);
        } catch (error) {
          setConnectedDirectNodeCommand(false);
        }
      })
      .catch(() => setConnectedDirectNodeCommand(false));
  }, [node, isP2PReady, sendCommand, getEnvsP2P]);

  useEffect(() => {
    if (node) {
      fetchUnbanRequests(node.id ?? node.nodeId);
    }
  }, [fetchUnbanRequests, node]);

  return (
    <NodeDetailsPageLayout
      activeTab="info"
      isWalletConnected={account.isConnected}
      loading={loadingFetchNode}
      nodeId={node?.id ?? node?.nodeId}
      notFound={!node}
      subtitle="Check node status, performance, and available resources before running a job"
    >
      {node ? (
        <>
          <NodeInfo envs={nodeEnvs} node={node} nodeOnline={connectedP2P || connectedDirectNodeCommand} />
          <JobsRevenueStats envs={nodeEnvs} />
          <BenchmarkJobs />
          <Environments
            envs={nodeEnvs}
            nodeInfo={{
              friendlyName: node.friendlyName,
              id: node.id ?? node.nodeId,
            }}
          />
          {node.banned === false && unbanRequests?.length === 0 ? null : <UnbanRequests node={node} />}
        </>
      ) : null}
    </NodeDetailsPageLayout>
  );
};

export default NodeDetailsPage;
