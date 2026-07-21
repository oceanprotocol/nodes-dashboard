import { getServiceStatusView } from '@/services/service-status';
import { CircularProgress } from '@mui/material';
import { ServiceStatusNumber } from '@oceanprotocol/lib';
import cx from 'classnames';
import styles from './service-status-chip.module.css';

type ServiceStatusChipProps = {
  status: ServiceStatusNumber | undefined;
  statusText?: string;
};

// Status chip for service tables: a spinner while the service is still settling, a coloured dot
// once it reaches a terminal/running state, plus the human label. Colour follows the status kind.
const ServiceStatusChip: React.FC<ServiceStatusChipProps> = ({ status, statusText }) => {
  const view = getServiceStatusView(status, statusText);
  return (
    <span className={cx('chip', styles.statusChip, styles[`status_${view.kind}`])}>
      {view.kind === 'pending' ? <CircularProgress size={10} /> : <span className={styles.statusDot} />}
      {view.label}
    </span>
  );
};

export default ServiceStatusChip;
