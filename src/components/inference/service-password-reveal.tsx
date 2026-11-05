import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Card from '@/components/card/card';
import { Fragment } from 'react';
import styles from './manage-service-page.module.css';

type ServicePasswordRevealProps = {
  /** Saved by the browser that launched the service; null elsewhere. */
  password: string | null;
  /** Held by the parent so the curl snippet shows the password only while it is revealed. */
  shown: boolean;
  onToggle: () => void;
  /** How this kind of service takes the password (serviceSignInHelp). */
  help: string;
};

const MASK = '•'.repeat(12);

// `code` spans in the help text become <code>.
const renderHelp = (help: string) =>
  help.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>));

/** The "Password" row of How to use. */
const ServicePasswordReveal: React.FC<ServicePasswordRevealProps> = ({ password, shown, onToggle, help }) => (
  <Card className={styles.endpoint} innerShadow="black" padding="xs" radius="lg" variant="glass">
    <div className={`chip chipGlass ${styles.endpointChip}`}>Password</div>
    <span className={`${styles.endpointPath} ph-no-capture`}>
      {password ? (shown ? password : MASK) : 'Not saved in this browser'}
    </span>
    <span className={`${styles.endpointDescription} ${styles.endpointHelp}`}>
      {password ? renderHelp(help) : 'Set a new password with Edit.'}
    </span>
    {password && (
      <div className={`flexRow gapSm ${styles.endpointAction}`}>
        <Button color="accent1" onClick={onToggle} size="sm" variant="outlined">
          {shown ? 'Hide' : 'Reveal'}
        </Button>
        {shown && <CopyButton color="accent2" contentToCopy={password} size="sm" variant="filled" />}
      </div>
    )}
  </Card>
);

export default ServicePasswordReveal;
