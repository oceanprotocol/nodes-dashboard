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
        <Card className={styles.root} padding="sm" radius="md" variant="success">
          <CheckCircleOutlineIcon className={styles.icon} />
          <h3>Eligible</h3>
          <div className={styles.content}>This node is active and can receive rewards</div>
        </Card>
      );
    case NodeEligibility.NON_ELIGIBLE:
      return (
        <Card className={styles.root} padding="sm" radius="md" variant="warning">
          <ErrorOutlineIcon className={styles.icon} />
          <h3>Not eligible</h3>
          <div className={styles.content}>
            This node is active, but does not meet the criteria for receiving rewards
            <strong>Reason:</strong> <span>{eligibilityCauseStr ?? '-'}</span>
          </div>
        </Card>
      );
    case NodeEligibility.BANNED:
      return (
        <Card className={styles.root} padding="sm" radius="md" variant="error">
          <HighlightOffIcon className={styles.icon} />
          <h3>Banned</h3>
          <div className={styles.content}>
            <div>
              This node is excluded from all operations and rewards
              <br />
              <strong> Reason:</strong> <span> {banInfo?.reason ?? 'Unknown'}</span>
            </div>
          </div>
        </Card>
      );
  }
};

export default Eligibility;
