import Container from '@/components/container/container';
import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeInfo from '@/components/node-details/node-info';
import UnbanRequests from '@/components/node-details/unban-requests';
import SectionTitle from '@/components/section-title/section-title';
import { NodeEligibility } from '@/types/nodes';

const RANDOM_ELIGIBILITY_MOCK =
  Object.values(NodeEligibility)[Math.floor(Math.random() * Object.values(NodeEligibility).length)];

const NodeDetailsPage = () => {
  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Node details"
        // TODO: replace with actual subtitle
        subTitle="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
      <div className="pageContentWrapper">
        <NodeInfo eligibility={RANDOM_ELIGIBILITY_MOCK} />
        {RANDOM_ELIGIBILITY_MOCK === NodeEligibility.BANNED ? <UnbanRequests /> : null}
        <JobsRevenueStats />
        <BenchmarkJobs />
        <Environments />
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
