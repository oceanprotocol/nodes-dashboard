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
  console.log(eligibilityCauseStr);
  switch (eligibility) {
    case NodeEligibility.ELIGIBLE:
      return (
        <Card className={styles.root} padding="sm" radius="md" shadow="success" variant="success">
          <CheckCircleOutlineIcon className={styles.icon} />
          <h3>Eligible</h3>
          <div className={styles.description}>This node is active and can receive rewards</div>
        </Card>
      );
    case NodeEligibility.NON_ELIGIBLE:
      return (
        <Card className={styles.root} padding="sm" radius="md" shadow="warning" variant="warning">
          <ErrorOutlineIcon className={styles.icon} />
          <h3>Not eligible</h3>
          <div className={styles.description}>
            This node is active, but does not meet the criteria for receiving rewards
          </div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{eligibilityCauseStr ?? 'Unknown'}</span>
          </div>
        </Card>
      );
    case NodeEligibility.BANNED:
      return (
        <Card className={styles.root} padding="sm" radius="md" shadow="error" variant="error">
          <HighlightOffIcon className={styles.icon} />
          <h3>Banned</h3>
          <div className={styles.description}>This node is excluded from all operations and rewards</div>
          <div className={styles.reason}>
            <strong className="alignSelfStart">Reason:</strong> <span>{banInfo?.reason ?? 'Unknown'}</span>
          </div>
        </Card>
      );
  }
};

export default Eligibility;
