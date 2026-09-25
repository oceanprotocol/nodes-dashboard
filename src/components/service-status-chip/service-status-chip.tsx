import { getComputeJobStatusView, getServiceStatusView, ServiceStatusView } from '@/services/service-status';
import { ServiceReadiness } from '@/types/service-readiness';
import { CircularProgress } from '@mui/material';
import { ServiceStatusNumber } from '@oceanprotocol/lib';
import cx from 'classnames';
import styles from './service-status-chip.module.css';

// Shared chip for service/job status: a spinner while the item is still settling, a coloured dot
// once it reaches a terminal/running state, plus the human label. Colour follows the status kind.
//
// A warming service is still on its way up, so it spins like a pending one — the colour (amber,
// not green) is what says "up but not serving yet".
//
// `compact` drops the label and keeps the marker alone, for places too tight for text; the label
// then rides on the accessible name and the tooltip so it is still reachable.
const StatusChip: React.FC<{ view: ServiceStatusView; compact?: boolean }> = ({ view, compact }) => (
  <span
    aria-label={compact ? view.label : undefined}
    className={cx(styles.statusChip, styles[`status_${view.kind}`])}
    role={compact ? 'img' : undefined}
    title={compact ? view.label : undefined}
  >
    {view.kind === 'pending' || view.kind === 'warming' ? (
      <CircularProgress size={10} />
    ) : (
      <span className={styles.statusDot} />
    )}
    {compact ? null : view.label}
  </span>
);

export const ServiceStatusChip: React.FC<{
  compact?: boolean;
  status: ServiceStatusNumber | undefined;
  statusText?: string;
  /** From the node's readiness probe — see types/service-readiness. Omitted, Running reads as before. */
  readiness?: ServiceReadiness | null;
}> = ({ compact, status, statusText, readiness }) => (
  <StatusChip compact={compact} view={getServiceStatusView(status, statusText, readiness)} />
);

export const JobStatusChip: React.FC<{ status: number | undefined; statusText?: string }> = ({
  status,
  statusText,
}) => <StatusChip view={getComputeJobStatusView(status, statusText)} />;

export default ServiceStatusChip;
