import Container from '@/components/container/container';
import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeInfo from '@/components/node-details/node-info';
import UnbanRequests from '@/components/node-details/unban-requests';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { useP2P } from '@/contexts/P2PContext';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

const NodeDetailsPage = () => {
  const { selectedNode, fetchNode } = useNodesContext();
  const { isReady, getEnvs } = useP2P();
  const { unbanRequests, fetchUnbanRequests } = useUnbanRequestsContext();
  const params = useParams<{ nodeId: string }>();

  useEffect(() => {
    if (!selectedNode && params?.nodeId) {
      fetchNode(params?.nodeId);
    }
  }, [selectedNode, params?.nodeId, fetchNode]);

  useEffect(() => {
    if (selectedNode?.id && isReady) {
      getEnvs(selectedNode.id);
    }
  }, [selectedNode?.id, isReady, getEnvs]);

  useEffect(() => {
    if (selectedNode?.id) {
      fetchUnbanRequests(selectedNode.id);
    }
  }, [selectedNode?.id, fetchUnbanRequests]);

  if (!selectedNode) {
    return (
      <Container className="pageRoot">
        <SectionTitle title="Node details" subTitle="Node not found" />
      </Container>
    );
  }

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Node details"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className="pageContentWrapper">
        <NodeInfo node={selectedNode} />
        <JobsRevenueStats />
        <BenchmarkJobs />
        <Environments
          nodeInfo={{
            friendlyName: selectedNode.friendlyName,
            id: selectedNode.id ?? selectedNode.nodeId,
          }}
        />
        {selectedNode.eligibilityCauseStr !== 'Banned' && unbanRequests?.length === 0 ? null : (
          <UnbanRequests node={selectedNode} />
        )}
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
