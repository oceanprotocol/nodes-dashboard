import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import Modal from '@/components/modal/modal';
import { useProfileContext } from '@/context/profile-context';
import { ComputeJob } from '@/types/jobs';
import { Stack } from '@mui/material';
import classNames from 'classnames';
import { useEffect } from 'react';
import styles from './modal.module.css';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

export const JobInfoModal = ({ job, open, onClose }: JobInfoModalProps) => {
  const { fetchNodeEnv, environment, nodeInfo } = useProfileContext();

  useEffect(() => {
    if (open && job?.environment) {
      fetchNodeEnv(job.peerId, job.environment);
    }
  }, [open, fetchNodeEnv, job]);

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

            {environment && (
              <div>
                <div className={styles.label} style={{ marginBottom: '8px' }}>
                  Environment
                </div>
                <EnvironmentCard key={environment.id} environment={environment} nodeInfo={nodeInfo} />
              </div>
            )}

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
