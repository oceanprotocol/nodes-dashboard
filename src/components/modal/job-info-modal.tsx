import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import Modal from '@/components/modal/modal';
import { getApiRoute } from '@/config';
import { ComputeEnvironment, EnvNodeInfo } from '@/types/environments';
import { ComputeJob } from '@/types/jobs';
import { Stack } from '@mui/material';
import axios from 'axios';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import styles from './modal.module.css';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

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
      <div
        className={classNames(styles.root, styles['variant-glass-shaded'], styles['padding-md'], styles['radius-md'])}
      >
        <div className={styles.content}>
          <Stack spacing={2}>
            <div>
              <div className={styles.label}>Job ID</div>
              <div className={styles.value}>{job.jobId}</div>
            </div>

            <div>
              <div className={styles.label} style={{ marginBottom: '8px' }}>
                Environment
              </div>
              {loading && <div className={styles.value}>Loading environment data...</div>}
              {error && (
                <div className={styles.value} style={{ color: 'var(--error)' }}>
                  {error}
                </div>
              )}
              {!loading && !error && environment && nodeInfo && (
                <EnvironmentCard key={environment.id} environment={environment} nodeInfo={nodeInfo} />
              )}
              {!loading && !error && !environment && <div className={styles.value}>No environment data available</div>}
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
        </div>
      </div>
    </Modal>
  );
};
