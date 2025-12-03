import Container from '@/components/container/container';
import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeInfo from '@/components/node-details/node-info';
import UnbanRequests from '@/components/node-details/unban-requests';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

const NodeDetailsPage = () => {
  const { selectedNode, fetchNode } = useNodesContext();
  const params = useParams<{ nodeId: string }>();

  useEffect(() => {
    if (!selectedNode && params?.nodeId) {
      fetchNode(params?.nodeId);
    }
  }, [selectedNode, params?.nodeId, fetchNode]);

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
        {selectedNode.eligibilityCauseStr === 'Banned' ? <UnbanRequests node={selectedNode} /> : null}
        <JobsRevenueStats node={selectedNode} />
        <BenchmarkJobs />
        <Environments node={selectedNode} />
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
