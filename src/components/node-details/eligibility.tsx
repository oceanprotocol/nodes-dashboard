import Card from '@/components/card/card';
import { Node } from '@/types/nodes';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import VerifiedIcon from '@mui/icons-material/Verified';
import styles from './eligibility.module.css';

type EligibilityProps = {
  isAdmin: boolean;
  node: Node;
};

const Eligibility = ({ isAdmin, node }: EligibilityProps) => {
  const now = Date.now();
  const isBanned = node.banned || (node.bannedUntil && now < node.bannedUntil);
  const isSuspended = node.suspendedUntil && now < node.suspendedUntil;
  const isVerified = !!node.latestBenchmarkResults && !isBanned && !isSuspended;

  // [All roles] Verified and NOT Banned / Suspended
  if (isVerified) {
    return (
      <Card direction="column" padding="sm" radius="md" shadow="success" spacing="sm" variant="success">
        <div className={styles.header}>
          <VerifiedIcon className={styles.icon} />
          <h3>Verified</h3>
        </div>
        <div>This node is active and verified via benchmark</div>
      </Card>
    );
  }

  if (isAdmin) {
    // [Admins] Banned / Suspended
    if (isBanned || isSuspended) {
      return (
        <Card direction="column" padding="sm" radius="md" shadow="error" spacing="sm" variant="error">
          <div className={styles.header}>
            <HighlightOffIcon className={styles.icon} />
            <h3>Banned</h3>
          </div>
          <div>This node is excluded from all operations and rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong>{' '}
            <span>{node.banReason || node.eligibilityCauseStr || 'Unknown'}</span>
          </div>
        </Card>
      );
    }

    // [Admins] NOT Eligible
    if (!node.eligible) {
      return (
        <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
          <div className={styles.header}>
            <ErrorOutlineIcon className={styles.icon} />
            <h3>Not eligible</h3>
          </div>
          <div>This node is active, but not eligible for rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{node.eligibilityCauseStr || 'Unknown'}</span>
          </div>
        </Card>
      );
    }

    // [Admins] NOT Verified
    return (
      <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
        <div className={styles.header}>
          <ErrorOutlineIcon className={styles.icon} />
          <h3>Not verified</h3>
        </div>
        <div>This node is active, but not verified via benchmark</div>
        <div className={styles.reason}>
          <strong className="alignSelfStart">Reason:</strong> <span>{node.eligibilityCauseStr || 'Unknown'}</span>
        </div>
      </Card>
    );
  }

  // [Non-admins] NOT Verified
  return (
    <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
      <div className={styles.header}>
        <ErrorOutlineIcon className={styles.icon} />
        <h3>Not verified</h3>
      </div>
      <div>This node is active, but not verified via benchmark</div>
    </Card>
  );
};

export default Eligibility;
