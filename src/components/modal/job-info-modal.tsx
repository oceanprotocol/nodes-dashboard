import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import EnvironmentCard from '@/components/environment-card/environment-card';
import { useProfileContext } from '@/context/profile-context';
import { ComputeJob } from '@/types/jobs';
import CloseIcon from '@mui/icons-material/Close';
import { Dialog, Stack, Typography } from '@mui/material';
import classNames from 'classnames';
import { useEffect, useMemo } from 'react';
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
  }, [open, job?.environment, fetchNodeEnv]);

  const jobEnvironment = useMemo(() => {
    return environment;
  }, [job?.environment]);

  if (!job) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <div
        className={classNames(styles.root, styles['variant-glass-shaded'], styles['padding-md'], styles['radius-md'])}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Job Information</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <CloseIcon />
          </button>
        </div>

        <div className={styles.content}>
          <Stack spacing={2}>
            <div>
              <div className={styles.label}>Job ID</div>
              <div className={styles.value}>{job.jobId}</div>
            </div>

            {jobEnvironment && (
              <div>
                <div className={styles.label} style={{ marginBottom: '8px' }}>
                  Environment
                </div>
                <EnvironmentCard key={jobEnvironment.id} environment={jobEnvironment} nodeInfo={nodeInfo} />
              </div>
            )}

            <Stack
              direction="row"
              spacing={2}
              sx={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-glass)' }}
            >
              <Stack direction="column" spacing={1} alignItems="center">
                <DownloadResultButton job={job} />
                <Typography variant="caption" color="var(--text-secondary)">
                  Download Result
                </Typography>
              </Stack>
              <Stack direction="column" spacing={1} alignItems="center">
                <DownloadLogsButton job={job} />
                <Typography variant="caption" color="var(--text-secondary)">
                  Download Logs
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </div>
      </div>
    </Dialog>
  );
};
