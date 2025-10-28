import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { NodeEligibility } from '@/types/nodes';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import styles from './eligibility.module.css';

type EligibilityProps = {
  eligibility: NodeEligibility;
};

const Eligibility = ({ eligibility }: EligibilityProps) => {
  switch (eligibility) {
    case NodeEligibility.ELIGIBLE:
      return (
        <Card className={styles.root} padding="sm" radius="md" variant="success">
          <CheckCircleOutlineIcon className={styles.icon} />
          <div className={styles.heading}>Eligible</div>
          <div className={styles.content}>This node is active and can receive rewards</div>
        </Card>
      );
    case NodeEligibility.NON_ELIGIBLE:
      return (
        <Card className={styles.root} padding="sm" radius="md" variant="warning">
          <ErrorOutlineIcon className={styles.icon} />
          <div className={styles.heading}>Not eligible</div>
          <div className={styles.content}>
            This node is active, but does not meet the criteria for receiving rewards
          </div>
        </Card>
      );
    case NodeEligibility.BANNED:
      return (
        <Card className={styles.root} padding="sm" radius="md" variant="error">
          <HighlightOffIcon className={styles.icon} />
          <div className={styles.heading}>Banned</div>
          <div className={styles.content}>
            <div>This node is excluded from all operations and rewards</div>
            {/* TODO replace ban reason text */}
            <div>
              <strong>Reason:</strong> Ban reason text here
            </div>
            {/* TODO link */}
            <Button className={styles.button}>More info</Button>
          </div>
        </Card>
      );
  }
};

export default Eligibility;
