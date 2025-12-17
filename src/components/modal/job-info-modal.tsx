import { DownloadLogsButton } from '@/components/button/download-logs-button';
import { DownloadResultButton } from '@/components/button/download-result-button';
import { ComputeJob } from '@/types/jobs';
import CloseIcon from '@mui/icons-material/Close';
import { Dialog, Stack, Typography } from '@mui/material';
import classNames from 'classnames';
import styles from './modal.module.css';

interface JobInfoModalProps {
  job: ComputeJob | null;
  open: boolean;
  onClose: () => void;
}

export const JobInfoModal = ({ job, open, onClose }: JobInfoModalProps) => {
  if (!job) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <div className={classNames(styles.root, styles['variant-glass-shaded'], styles['padding-md'], styles['radius-md'])}>
        <div className={styles.header}>
          <h2 className={styles.title}>Job Information</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <CloseIcon />
          </button>
        </div>

        <div className={styles.content}>
          <Stack spacing={2}>
            <div>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, marginBottom: '4px' }}>
                Job ID
              </Typography>
              <Typography sx={{ color: 'var(--text-primary)', fontSize: 14 }}>{job.jobId}</Typography>
            </div>

            {job.environment && (
              <div>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, marginBottom: '4px' }}>
                  Environment
                </Typography>
                <Typography sx={{ color: 'var(--text-primary)', fontSize: 14 }}>{job.environment}</Typography>
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
