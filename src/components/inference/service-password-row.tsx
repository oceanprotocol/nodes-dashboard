import Card from '@/components/card/card';
import { Fragment } from 'react';
import styles from './manage-service-page.module.css';

// `code` spans in the help text become <code>.
const renderHelp = (help: string) =>
  help.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>));

/** The "Password" row of How to use. The dashboard does not keep the password, so it only says how to use it. */
const ServicePasswordRow: React.FC<{ help: string }> = ({ help }) => (
  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
    <div className={`chip chipGlass ${styles.endpointChip}`}>Password</div>
    <span className={styles.endpointPath}>Set at launch</span>
    <span className={`${styles.endpointDescription} ${styles.endpointHelp}`}>
      {renderHelp(help)} Lost it? Set a new one with Edit.
    </span>
  </Card>
);

export default ServicePasswordRow;
