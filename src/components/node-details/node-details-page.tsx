import BenchmarkJobs from '@/components/node-details/benchmark-jobs';
import Environments from '@/components/node-details/environments';
import JobsRevenueStats from '@/components/node-details/jobs-revenue-stats';
import NodeDetailsPageLayout from '@/components/node-details/node-details-page-layout';
import NodeInfo from '@/components/node-details/node-info';
import NodeResourceUsage from '@/components/node-details/node-resource-usage';
import NodeRunningWorkloads from '@/components/node-details/node-running-workloads';
import ServiceStats from '@/components/node-details/service-stats';
import UnbanRequests from '@/components/node-details/unban-requests';
import SectionTitle from '@/components/section-title/section-title';
import { useNodesContext } from '@/context/nodes-context';
import { useUnbanRequestsContext } from '@/context/unban-requests-context';
import { useP2P } from '@/contexts/P2PContext';
import { directNodeCommand } from '@/lib/direct-node-command';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './node-details-page.module.css';

const NodeDetailsPage: React.FC = () => {
  const params = useParams<{ nodeId: string }>();

  const { account } = useOceanAccount();

  const { getEnvs: getEnvsP2P, isReady: isP2PReady, sendCommand } = useP2P();

  const { selectedNode, fetchNode, loadingFetchNode } = useNodesContext();
  const { unbanRequests, fetchUnbanRequests } = useUnbanRequestsContext();

  const [connectedP2P, setConnectedP2P] = useState<boolean | null>(null);
  const [maybeStaleEnvData, setMaybeStaleEnvData] = useState<boolean | undefined>(undefined);
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
   * Owner/admin gate, duplicated from NodeRunningWorkloads (which returns null for non-owners)
   * so the "Running now" heading is hidden on exactly the same condition as the content it
   * introduces. Kept in sync with that component's own check.
   */
  const isOwner = useMemo(() => {
    const addr = account.address?.toLowerCase();
    if (!addr || !node) {
      return false;
    }
    const admins = node.allowedAdmins?.map((a) => a.toLowerCase()) ?? [];
    return admins.includes(addr) || node.address?.toLowerCase() === addr;
  }, [account.address, node]);

  /**
   * Check node connectivity by p2p and direct node command by loading its envs
   */
  useEffect(() => {
    if (!node) return;
    setMaybeStaleEnvData(undefined);
    setNodeEnvs([]);
    const peerId = node.id ?? node.nodeId;

    const p2pPromise = isP2PReady
      ? getEnvsP2P(node.currentAddrs?.length ? node.currentAddrs : peerId)
          .then((envs) => {
            setNodeEnvs((prev) => (prev.length > 0 ? prev : envs));
            setConnectedP2P(true);
            return envs;
          })
          .catch(() => {
            setConnectedP2P(false);
            return [];
          })
      : Promise.resolve([]);

    const directPromise = directNodeCommand({
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
          return envs;
        } catch {
          setConnectedDirectNodeCommand(false);
          return [];
        }
      })
      .catch(() => {
        setConnectedDirectNodeCommand(false);
        return [];
      });

    Promise.all([p2pPromise, directPromise]).then(([p2pEnvs, directEnvs]) => {
      const gotEnvs = p2pEnvs.length > 0 || directEnvs.length > 0;
      if (!gotEnvs && node.computeEnvironments?.environments && node.computeEnvironments.environments.length > 0) {
        setNodeEnvs(node.computeEnvironments.environments);
        setMaybeStaleEnvData(true);
      }
    });
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
          <div className={styles.sections}>
            {/*
              NodeInfo gets no heading of its own: it identifies the node this page is about, so
              one would only repeat the page title. It still sits inside `.sections` so the gap
              below it matches every other group boundary.
            */}
            <section className={styles.section}>
              <NodeInfo envs={nodeEnvs} node={node} nodeOnline={connectedP2P || connectedDirectNodeCommand} />
            </section>

            <section className={styles.section}>
              <SectionTitle
                secondary
                title="Jobs and revenue"
                subTitle="Compute jobs this node has run and what they earned"
              />
              <div className={styles.group}>
                <JobsRevenueStats envs={nodeEnvs} />
                {/* Owner-only, and gated here so no heading introduces an empty group. */}
                {isOwner ? <NodeRunningWorkloads node={node} show="jobs" /> : null}
              </div>
            </section>

            {/*
              Services are their own group rather than folded into the jobs numbers above: those
              are compute-job earnings, while service economics are priced on reserved time.
            */}
            <section className={styles.section}>
              <SectionTitle
                secondary
                title="Inference and services"
                subTitle="Service revenue, reserved time and the models this node serves"
              />
              <div className={styles.group}>
                <ServiceStats />
                {isOwner ? <NodeRunningWorkloads node={node} show="services" /> : null}
              </div>
            </section>

            <section className={styles.section}>
              <SectionTitle
                secondary
                title="Hardware and environments"
                subTitle="Resources, benchmark history and the compute environments this node offers"
              />
              <div className={styles.group}>
                <NodeResourceUsage envs={nodeEnvs} node={node} />
                <Environments
                  envs={nodeEnvs}
                  envsTimestamp={node.computeEnvironments?.timestamp}
                  staleEnvData={maybeStaleEnvData}
                  nodeInfo={{
                    friendlyName: node.friendlyName,
                    id: node.id ?? node.nodeId,
                  }}
                />
                <BenchmarkJobs />
              </div>
            </section>

            {!node.banned && unbanRequests?.length === 0 ? null : (
              <section className={styles.section}>
                <SectionTitle secondary title="Moderation" subTitle="Ban status and unban requests for this node" />
                <div className={styles.group}>
                  <UnbanRequests node={node} />
                </div>
              </section>
            )}
          </div>
        </>
      ) : null}
    </NodeDetailsPageLayout>
  );
};

export default NodeDetailsPage;
