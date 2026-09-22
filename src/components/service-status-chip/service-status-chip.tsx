import { getComputeJobStatusView, getServiceStatusView, ServiceStatusView } from '@/services/service-status';
import { CircularProgress } from '@mui/material';
import { ServiceStatusNumber } from '@oceanprotocol/lib';
import cx from 'classnames';
import styles from './service-status-chip.module.css';

// Shared chip for service/job status: a spinner while the item is still settling, a coloured dot
// once it reaches a terminal/running state, plus the human label. Colour follows the status kind.
const StatusChip: React.FC<{ view: ServiceStatusView; compact?: boolean }> = ({ view, compact }) => (
  <span
    aria-label={compact ? view.label : undefined}
    className={cx(styles.statusChip, styles[`status_${view.kind}`])}
    role={compact ? 'img' : undefined}
    title={compact ? view.label : undefined}
  >
    {view.kind === 'pending' ? <CircularProgress size={10} /> : <span className={styles.statusDot} />}
    {compact ? null : view.label}
  </span>
);

export const ServiceStatusChip: React.FC<{
  compact?: boolean;
  status: ServiceStatusNumber | undefined;
  statusText?: string;
}> = ({ compact, status, statusText }) => (
  <StatusChip compact={compact} view={getServiceStatusView(status, statusText)} />
);

export const JobStatusChip: React.FC<{ status: number | undefined; statusText?: string }> = ({
  status,
  statusText,
}) => <StatusChip view={getComputeJobStatusView(status, statusText)} />;

export default ServiceStatusChip;
