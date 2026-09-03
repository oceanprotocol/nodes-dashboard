import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { JobLogsPanel } from '@/components/modal/job-logs-panel';
import Modal from '@/components/modal/modal';
import ResourceUsagePanel from '@/components/resource-usage/resource-usage-panel';
import { getApiRoute } from '@/config';
import { useJobMetrics } from '@/hooks/use-job-metrics';
import { useMetricsHistory } from '@/hooks/use-metrics-history';
import { resolveNodeUri } from '@/lib/resolve-node-uri';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { ComputeJob } from '@/types/jobs';
import { formatDuration, getJobDurationSeconds } from '@/utils/formatters';
import { resourceDescriptionsById } from '@/utils/resources';
import { Stack } from '@mui/material';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

// Job resources are display units (CPU cores, RAM/disk GB); the resource usage panel wants bytes for
// RAM/disk so a gauge still has a denominator when the node's own runtime snapshot lacks one
// (unconstrained CPU, no disk quota reported).
const GIB = 1024 ** 3;

// Job resource amounts are stored in display units (CPU cores, RAM/disk GB, GPU units),
// matching how they are submitted in the resources step.
const formatResourceRow = (id: string, amount: number): string => {
  if (id === 'cpu') return `CPU: ${amount} ${amount === 1 ? 'core' : 'cores'}`;
  if (id === 'ram') return `RAM: ${amount} GB`;
  if (id === 'disk') return `Disk: ${amount} GB`;
  if (id.toLowerCase().startsWith('gpu')) return `GPU: ${amount} ${amount === 1 ? 'unit' : 'units'}`;
  return `${id}: ${amount}`;
};

export const JobInfoModal = ({ job, open, onClose }: JobInfoModalProps) => {
  const [environment, setEnvironment] = useState<ComputeEnvironment | null>(null);
  const [nodeInfo, setNodeInfo] = useState<EnvNodeInfo | null>(null);
  const [nodeAddrs, setNodeAddrs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const nodeUri = useMemo(
    () => resolveNodeUri(job?.peerId ?? '', job?.multiaddrs?.length ? job.multiaddrs : nodeAddrs),
    [job?.peerId, job?.multiaddrs, nodeAddrs]
  );

  useEffect(() => {
    const fetchNodeEnv = async () => {
      if (!open || !job?.environment || !job?.peerId) {
        return;
      }

      setLoading(true);
      setError(null);
      setEnvironment(null);
      setNodeInfo(null);
      setNodeAddrs(null);

      try {
        const response = await axios.get(`${getApiRoute('nodes')}?filters[id][value]=${job.peerId}`);

        if (!response.data?.nodes || response.data.nodes.length === 0) {
          setError('Node not found');
          return;
        }

        const sanitizedData = response.data.nodes.map((element: any) => element._source)[0];

        if (!sanitizedData?.computeEnvironments?.environments) {
          setError('No compute environments available');
          return;
        }

        const env = sanitizedData.computeEnvironments.environments.find((e: any) => e.id === job.environment);

        if (!env) {
          setError('Environment not found');
          return;
        }

        setEnvironment(env);
        setNodeInfo({ id: sanitizedData.id, friendlyName: sanitizedData.friendlyName });
        setNodeAddrs(Array.isArray(sanitizedData.currentAddrs) ? sanitizedData.currentAddrs : null);
      } catch (err) {
        console.error('Error fetching node env:', err);
        setError('Failed to fetch environment data');
      } finally {
        setLoading(false);
      }
    };

    fetchNodeEnv();
  }, [open, job?.peerId, job?.environment]);

  // Best-effort runtime metrics — polled only while the modal is open,
  // using the SAME cached node token JobLogsPanel mints below (no extra wallet signature). Called
  // unconditionally (before the `!job` early return) per rules of hooks; both hooks already accept a
  // null job and no-op until one is set.
  const metrics = useJobMetrics(job, open, nodeUri);
  const metricsHistory = useMetricsHistory(metrics, job?.jobId ?? '');

  if (!job) return null;

  const durationSeconds = getJobDurationSeconds(job);
  const resources = Array.isArray(job.resources) ? job.resources : [];
  const resourceAmount = (id: string): number | undefined => resources.find((r) => r.id === id)?.amount;
  // The snapshot names resources by opaque id (`gpu2`, `cpu`); the node's environment knows the
  // hardware behind them.
  const hardwareNames = resourceDescriptionsById(environment?.resources);
  const bookedResources = {
    cpuCores: resourceAmount('cpu'),
    ramBytes: resourceAmount('ram') !== undefined ? (resourceAmount('ram') as number) * GIB : undefined,
    diskBytes: resourceAmount('disk') !== undefined ? (resourceAmount('disk') as number) * GIB : undefined,
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Job information" width="md">
      <Stack spacing={2}>
        <div>
          <strong>Job name</strong>
          <div className="wordBreakWord">{job.metadata?.name || '—'}</div>
        </div>

        <div>
          <strong>Job ID</strong>
          <div className="wordBreakWord">{job.jobId}</div>
        </div>

        <h4>Resources</h4>
        <div>
          <div className="textBold" style={{ marginBottom: '8px' }}>
            Selected environment & resources
          </div>
          {loading && <div>Loading environment data...</div>}
          {!loading && environment && nodeInfo ? (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              nodeInfo={nodeInfo}
              usedResources={resources}
              jobDurationSeconds={durationSeconds}
            />
          ) : null}
          {/* Fallback when the environment can no longer be fetched: still show the
              actual used resources and duration so the info is never lost. */}
          {!loading && (!environment || !nodeInfo) && (
            <Stack spacing={0.5}>
              {error && <div style={{ color: 'var(--text-secondary)' }}>{error}</div>}
              {resources.length > 0 ? (
                resources.map((resource) => (
                  <div key={resource.id}>{formatResourceRow(resource.id, resource.amount)}</div>
                ))
              ) : (
                <div>No resource usage available</div>
              )}
              <div>Duration: {durationSeconds == null ? '—' : formatDuration(durationSeconds)}</div>
            </Stack>
          )}

          {/* Nothing here at all when the node reports no runtime metrics (collection disabled, or
              the caller lacks owner credentials) — absence is normal, not an error state. */}
          {metrics && (
            <div style={{ marginTop: '16px' }}>
              <ResourceUsagePanel
                bookedResources={bookedResources}
                hardwareNames={hardwareNames}
                history={metricsHistory}
                metrics={metrics}
                title={<strong>Resource usage</strong>}
                variant="compact"
              />
            </div>
          )}
        </div>

        {!loading && !error && !nodeUri && (
          <div style={{ marginTop: '24px', color: 'var(--error)' }}>
            This node has no reachable addresses, so its logs and results can&apos;t be retrieved.
          </div>
        )}

        {nodeUri && (
          <>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-glass)' }}>
              <JobLogsPanel job={job} open={open} nodeUri={nodeUri} />
            </div>

            <Stack direction="row" spacing={1} sx={{ marginTop: '16px' }}>
              <DownloadResultButton job={job} nodeUri={nodeUri} />
              <DownloadLogsButton job={job} nodeUri={nodeUri} />
            </Stack>
          </>
        )}
      </Stack>
    </Modal>
  );
};
