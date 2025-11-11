import Container from '@/components/container/container';
import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeInfo from '@/components/node-details/node-info';
import UnbanRequests from '@/components/node-details/unban-requests';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';

const NodeDetailsPage = () => {
  const { selectedNode } = useNodesContext();

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
        {selectedNode.eligibilityCauseStr === 'Banned' ? <UnbanRequests /> : null}
        <JobsRevenueStats />
        <BenchmarkJobs />
        <Environments />
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
