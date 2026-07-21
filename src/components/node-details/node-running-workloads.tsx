import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { Table } from '@/components/table/table';
import { TableTypeEnum } from '@/components/table/table-type';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Node } from '@/types';
import { CircularProgress } from '@mui/material';
import { NodeComputeJob, ServiceJobListed, ServiceStatusNumber } from '@oceanprotocol/lib';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './node-running-workloads.module.css';

type NodeRunningWorkloadsProps = {
  node: Node;
};

// Node owners can see everything running on their hardware — services (getServices) and compute jobs
// (getNodeJobs), both node-wide across all owners. Only currently-running items are shown. Jobs load
// automatically (unauthenticated); services need a signature, so they load only on button press.
const NodeRunningWorkloads = ({ node }: NodeRunningWorkloadsProps) => {
  const { account } = useOceanAccount();
  const { getServices, getNodeJobs, isReady } = useP2P();
  const { withNodeAuth } = useNodeAuth();

  const nodeId = node.id ?? node.nodeId;

  // Owner/admin gate — the connected wallet must be in allowedAdmins or match the node address.
  const isOwner = useMemo(() => {
    const addr = account.address?.toLowerCase();
    if (!addr) {
      return false;
    }
    const admins = node.allowedAdmins?.map((a) => a.toLowerCase()) ?? [];
    return admins.includes(addr) || node.address?.toLowerCase() === addr;
  }, [account.address, node.allowedAdmins, node.address]);

  // Reach the node by its full multiaddrs when known (avoids a peer lookup), else by peer id.
  const nodeUri: NodeUri = useMemo(
    () => (node.currentAddrs?.length ? node.currentAddrs : [nodeId]),
    [node.currentAddrs, nodeId]
  );

  // --- Services ---
  const [services, setServices] = useState<ServiceJobListed[]>([]);
  // Services need a signature (withNodeAuth), so they don't auto-load — the user triggers the first
  // fetch. Once loaded, the same button re-fetches (acts as Refresh) and the table stays visible.
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!isReady || !isOwner || !nodeId) {
      return;
    }
    setServicesLoading(true);
    setServicesError(null);
    try {
      const result = await withNodeAuth(nodeId, nodeUri, (token) => getServices(nodeUri, token));
      const running = result
        .filter((s) => s.status === ServiceStatusNumber.Running)
        .sort((a, b) => (a.dateCreated < b.dateCreated ? 1 : -1));
      setServices(running);
      setServicesLoaded(true);
    } catch (err) {
      console.error('Failed to load node services:', err);
      setServicesError(err instanceof Error ? err.message : 'Failed to load services running on this node.');
    } finally {
      setServicesLoading(false);
    }
  }, [isReady, isOwner, nodeId, nodeUri, withNodeAuth, getServices]);

  // --- Compute jobs ---
  const [jobs, setJobs] = useState<NodeComputeJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!isReady || !isOwner || !nodeId) {
      return;
    }
    setJobsLoading(true);
    setJobsError(null);
    try {
      const result = await getNodeJobs(nodeUri);
      const running = result
        .filter((j) => j.statusText === 'running')
        .sort((a, b) => (a.dateCreated < b.dateCreated ? 1 : -1));
      setJobs(running);
    } catch (err) {
      console.error('Failed to load node jobs:', err);
      setJobsError(err instanceof Error ? err.message : 'Failed to load jobs running on this node.');
    } finally {
      setJobsLoading(false);
    }
  }, [isReady, isOwner, nodeId, nodeUri, getNodeJobs]);

  // Jobs need no signature — load them as soon as the node is reachable and the viewer is an owner.
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  if (!isOwner) {
    return null;
  }

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <div className={styles.head}>
          <div>
            <h3>Running services</h3>
            <span className="textSecondary">Service-on-demand containers currently running on this node</span>
          </div>
          <Button
            color="accent2"
            disabled={!isReady || servicesLoading}
            loading={servicesLoading}
            onClick={loadServices}
            size="md"
            variant={servicesLoaded ? 'outlined' : 'filled'}
          >
            {servicesLoaded ? 'Refresh' : 'Load services'}
          </Button>
        </div>

        {servicesError && <p className="textErrorDarker">{servicesError}</p>}

        {servicesLoading && services.length === 0 ? (
          <div className={styles.centered}>
            <CircularProgress size={18} />
          </div>
        ) : !servicesLoaded ? null : services.length === 0 ? (
          <p className="textSecondary" style={{ margin: 0 }}>
            No services running on this node.
          </p>
        ) : (
          <Table<ServiceJobListed>
            autoHeight
            data={services}
            getRowId={(row) => row.serviceId}
            paginationType="none"
            tableType={TableTypeEnum.NODE_SERVICES}
          />
        )}
      </Card>

      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        <div className={styles.head}>
          <div>
            <h3>Running jobs</h3>
            <span className="textSecondary">Compute jobs currently running on this node</span>
          </div>
          <Button
            color="accent2"
            disabled={!isReady || jobsLoading}
            loading={jobsLoading}
            onClick={loadJobs}
            size="md"
            variant="filled"
          >
            Refresh
          </Button>
        </div>

        {jobsError && <p className="textErrorDarker">{jobsError}</p>}

        {jobsLoading && jobs.length === 0 ? (
          <div className={styles.centered}>
            <CircularProgress size={18} />
          </div>
        ) : jobs.length === 0 ? (
          <p className="textSecondary" style={{ margin: 0 }}>
            No jobs running on this node.
          </p>
        ) : (
          <Table<NodeComputeJob>
            autoHeight
            data={jobs}
            getRowId={(row) => row.jobId}
            paginationType="none"
            tableType={TableTypeEnum.NODE_JOBS}
          />
        )}
      </Card>
    </>
  );
};

export default NodeRunningWorkloads;
