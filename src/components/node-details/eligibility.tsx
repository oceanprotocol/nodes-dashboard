import Card from '@/components/card/card';
import { NodeBanInfo, NodeEligibility } from '@/types/nodes';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import styles from './eligibility.module.css';

type EligibilityProps = {
  eligibility: NodeEligibility;
  eligibilityCauseStr?: string;
  banInfo?: NodeBanInfo;
};

const Eligibility = ({ eligibility, eligibilityCauseStr, banInfo }: EligibilityProps) => {
  switch (eligibility) {
    case NodeEligibility.ELIGIBLE:
      return (
        <Card direction="column" padding="sm" radius="md" shadow="success" spacing="sm" variant="success">
          <div className={styles.header}>
            <CheckCircleOutlineIcon className={styles.icon} />
            <h3>Eligible</h3>
          </div>
          <div>This node is active and can receive rewards</div>
        </Card>
      );
    case NodeEligibility.NON_ELIGIBLE:
      return (
        <Card direction="column" padding="sm" radius="md" shadow="warning" spacing="sm" variant="warning">
          <div className={styles.header}>
            <ErrorOutlineIcon className={styles.icon} />
            <h3>Not eligible</h3>
          </div>
          <div>This node is active, but does not meet the criteria for receiving rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{eligibilityCauseStr ?? 'Unknown'}</span>
          </div>
        </Card>
      );
    case NodeEligibility.BANNED:
      return (
        <Card direction="column" padding="sm" radius="md" shadow="error" spacing="sm" variant="error">
          <div className={styles.header}>
            <HighlightOffIcon className={styles.icon} />
            <h3>Banned</h3>
          </div>
          <div>This node is excluded from all operations and rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{banInfo?.reason ?? 'Unknown'}</span>
          </div>
        </Card>
      );
  }
};

export default Eligibility;
