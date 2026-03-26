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
import { CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

const NodeDetailsPage = () => {
  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();
  const { clearEnvs, getEnvs, isReady: isP2PReady } = useP2P();
  const { unbanRequests, fetchUnbanRequests } = useUnbanRequestsContext();
  const params = useParams<{ nodeId: string }>();

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

  useEffect(() => {
    clearEnvs();
    if (node && isP2PReady) {
      getEnvs(node.id ?? node.nodeId);
    }
  }, [isP2PReady, clearEnvs, node, getEnvs]);

  useEffect(() => {
    if (node) {
      fetchUnbanRequests(node.id ?? node.nodeId);
    }
  }, [fetchUnbanRequests, node]);

  if (loadingFetchNode) {
    return (
      <Container className="pageRoot">
        <SectionTitle
          moreReadable
          title="Node details"
          subTitle={
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Retrieving node details...</span>
            </div>
          }
        />
      </Container>
    );
  }

  if (!node) {
    return (
      <Container className="pageRoot">
        <SectionTitle moreReadable title="Node details" subTitle="Node not found" />
      </Container>
    );
  }

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Node details"
        subTitle="Check node status, performance, and available resources before running a job"
      />
      <div className="pageContentWrapper">
        <NodeInfo node={node} />
        <JobsRevenueStats />
        <BenchmarkJobs />
        <Environments
          nodeInfo={{
            friendlyName: node.friendlyName,
            id: node.id ?? node.nodeId,
          }}
        />
        {node.banned === false && unbanRequests?.length === 0 ? null : <UnbanRequests node={node} />}
      </div>
    </Container>
  );
};

export default NodeDetailsPage;
