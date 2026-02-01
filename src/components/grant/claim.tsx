import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { formatDateTime, formatNumber } from '@/utils/formatters';
import styles from './claim.module.css';

const Claim: React.FC = () => {
  const mockRedeemBefore = new Date();
  const mockSymbol = 'USDC';
  const mockAmount = 100;

  return (
    <Card className={styles.root} direction="column" padding="md" radius="lg" spacing="lg" variant="glass-shaded">
      <div className={styles.group}>
        <h3>Verification successful</h3>
        <div>You are eligible for grant distribution</div>
      </div>
      <Card className={styles.amountCard} radius="md" variant="accent1-outline">
        <h3>Claimable amount</h3>
        <div className={styles.values}>
          <span className={styles.token}>{mockSymbol}</span>
          &nbsp;
          <span className={styles.amount}>{formatNumber(mockAmount)}</span>
        </div>
        <h3>Redeem before</h3>
        <h3 className={styles.values}>{formatDateTime(mockRedeemBefore.getTime() / 1000)}</h3>
      </Card>
      <Button className="alignSelfStretch" color="accent2" size="lg" type="submit" variant="filled">
        Redeem grant
      </Button>
    </Card>
  );
};

export default Claim;
