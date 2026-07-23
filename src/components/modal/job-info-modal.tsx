import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import Modal from '@/components/modal/modal';
import { getApiRoute } from '@/config';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { ComputeJob } from '@/types/jobs';
import { formatDuration, getJobDurationSeconds } from '@/utils/formatters';
import { Stack } from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNodeEnv = async () => {
      if (!open || !job?.environment || !job?.peerId) {
        return;
      }

      setLoading(true);
      setError(null);
      setEnvironment(null);
      setNodeInfo(null);

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
      } catch (err) {
        console.error('Error fetching node env:', err);
        setError('Failed to fetch environment data');
      } finally {
        setLoading(false);
      }
    };

    fetchNodeEnv();
  }, [open, job]);

  if (!job) return null;

  const durationSeconds = getJobDurationSeconds(job);
  const resources = Array.isArray(job.resources) ? job.resources : [];

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

        <div>
          <strong style={{ marginBottom: '8px' }}>Resources used</strong>
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
                resources.map((resource) => <div key={resource.id}>{formatResourceRow(resource.id, resource.amount)}</div>)
              ) : (
                <div>No resource usage available</div>
              )}
              <div>Duration: {durationSeconds == null ? '—' : formatDuration(durationSeconds)}</div>
            </Stack>
          )}
        </div>

        <Stack
          direction="row"
          spacing={1}
          sx={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-glass)' }}
        >
          <DownloadResultButton job={job} />
          <DownloadLogsButton job={job} />
        </Stack>
      </Stack>
    </Modal>
  );
};
