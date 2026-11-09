import Card from '@/components/card/card';
import { Fragment } from 'react';
import styles from './manage-service-page.module.css';

// `code` spans in the help text become <code>.
const renderHelp = (help: string) =>
  help.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>));

/**
 * The "Password" row of How to use. The dashboard does not keep the password, so it only says how to
 * use it, and links to the page's Edit (which sets a new one).
 */
const ServicePasswordRow: React.FC<{ help: string; canEdit: boolean; onEdit: () => void }> = ({
  help,
  canEdit,
  onEdit,
}) => (
  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
    <div className={`chip chipGlass ${styles.endpointChip}`}>Password</div>
    <span className={styles.passwordInfo}>{renderHelp(help)}</span>
    <span className={`${styles.endpointAction} ${styles.passwordHelp}`}>
      Lost it? Set a new one with{' '}
      <button className={styles.editLink} disabled={!canEdit} onClick={onEdit} type="button">
        Edit
      </button>
    </span>
  </Card>
);

export default ServicePasswordRow;
