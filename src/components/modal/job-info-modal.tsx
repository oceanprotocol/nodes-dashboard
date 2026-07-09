import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { JobLogsPanel } from '@/components/modal/job-logs-panel';
import Modal from '@/components/modal/modal';
import { getApiRoute } from '@/config';
import { resolveNodeUri } from '@/lib/resolve-node-uri';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { ComputeJob } from '@/types/jobs';
import { Stack } from '@mui/material';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

export const JobInfoModal = ({ job, open, onClose }: JobInfoModalProps) => {
  const [environment, setEnvironment] = useState<ComputeEnvironment | null>(null);
  const [nodeInfo, setNodeInfo] = useState<EnvNodeInfo | null>(null);
  const [nodeAddrs, setNodeAddrs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const nodeUri = useMemo(() => resolveNodeUri(job?.peerId ?? '', nodeAddrs), [job?.peerId, nodeAddrs]);

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
          console.error('No nodes found in response');
          setError('Node not found');
          return;
        }

        const sanitizedData = response.data.nodes.map((element: any) => element._source)[0];

        if (!sanitizedData) {
          console.error('No node data found');
          setError('Invalid node data');
          return;
        }

        if (!sanitizedData.computeEnvironments?.environments) {
          console.error('No compute environments found for node:', sanitizedData);
          setError('No compute environments available');
          return;
        }

        const env = sanitizedData.computeEnvironments.environments.find((env: any) => env.id === job.environment);

        if (!env) {
          console.error(
            `Environment ${job.environment} not found. Available:`,
            sanitizedData.computeEnvironments.environments.map((e: any) => e.id)
          );
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
  }, [open, job]);

  if (!job) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title="Job information" width="md">
      <Stack spacing={2}>
        <div>
          <strong>Job ID</strong>
          <div className="wordBreakWord">{job.jobId}</div>
        </div>

        <div>
          <strong style={{ marginBottom: '8px' }}>Environment</strong>
          {loading && <div>Loading environment data...</div>}
          {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
          {!loading && !error && environment && nodeInfo && (
            <EnvironmentCard key={environment.id} environment={environment} nodeInfo={nodeInfo} />
          )}
          {!loading && !error && !environment && <div>No environment data available</div>}
        </div>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-glass)' }}>
          <JobLogsPanel job={job} open={open} nodeUri={nodeUri} />
        </div>

        <Stack direction="row" spacing={1} sx={{ marginTop: '16px' }}>
          <DownloadResultButton job={job} nodeUri={nodeUri} />
          <DownloadLogsButton job={job} nodeUri={nodeUri} />
        </Stack>
      </Stack>
    </Modal>
  );
};
