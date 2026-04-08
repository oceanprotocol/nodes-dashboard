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
  const { banReason, eligibilityCauseStr } = node;
  const verified = !!node.latestBenchmarkResults;

  // [All roles] Verified and not banned
  if (verified && !node.banned) {
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
    // [Admins] Banned
    if (node.banned) {
      return (
        <Card direction="column" padding="sm" radius="md" shadow="error" spacing="sm" variant="error">
          <div className={styles.header}>
            <HighlightOffIcon className={styles.icon} />
            <h3>Banned</h3>
          </div>
          <div>This node is excluded from all operations and rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{banReason ?? 'Unknown'}</span>
          </div>
        </Card>
      );
    }

    // [Admins] Non-eligible
    if (!node.eligible) {
      return (
        <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
          <div className={styles.header}>
            <ErrorOutlineIcon className={styles.icon} />
            <h3>Not eligible</h3>
          </div>
          <div>This node is active, but not eligible for rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{eligibilityCauseStr ?? 'Unknown'}</span>
          </div>
        </Card>
      );
    }

    // [Admins] Not verified
    return (
      <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
        <div className={styles.header}>
          <ErrorOutlineIcon className={styles.icon} />
          <h3>Not verified</h3>
        </div>
        <div>This node is active, but not verified via benchmark</div>
        <div className={styles.reason}>
          <strong className="alignSelfStart">Reason:</strong> <span>{eligibilityCauseStr ?? 'Unknown'}</span>
        </div>
      </Card>
    );
  }

  // [Non-admins] Not verified
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
