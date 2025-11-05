import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import classNames from 'classnames';
import styles from './payment.module.css';

// TODO replace mock data

const Payment = () => {
  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Payment</h3>
      <Card className={styles.insufficientFunds} padding="sm" radius="md" variant="error">
        <HighlightOffIcon className={styles.icon} />
        <h3>Insufficient funds</h3>
        <div className={styles.message}>You do not have enough funds deposited in the escrow contract</div>
      </Card>
      <Card className={styles.cost} radius="md" variant="accent1-outline">
        <h3>Estimated total cost</h3>
        <div className={styles.values}>
          <span className={styles.token}>OCEAN</span>
          &nbsp;
          <span className={styles.amount}>{100.5}</span>
        </div>
        <h3>User available funds in escrow</h3>
        <div className={styles.values}>
          <span className={styles.token}>OCEAN</span>
          &nbsp;
          <span className={styles.amount}>{99}</span>
        </div>
        <h3 className={styles.sm}>User available funds in wallet</h3>
        <div className={classNames(styles.values, styles.sm)}>
          <span className={styles.token}>OCEAN</span>
          &nbsp;
          <span className={classNames(styles.amount, styles.sm)}>{12345.6789}</span>
        </div>
      </Card>
      <form className={styles.form}>
        <Card direction="column" padding="sm" radius="md" spacing="md" variant="glass">
          <div className={styles.row}>
            <Select label="Fee token address" />
            <Input endAdornment="OCEAN" label="Amount" type="number" />
          </div>
          <div className={styles.buttons}>
            <Button className={styles.button} color="accent1">
              Authorize
            </Button>
            <Button className={styles.button} color="accent1">
              Deposit
            </Button>
          </div>
        </Card>
      </form>
      <Button className={styles.nextButton} color="accent2" href={`/run-job/summary`} size="lg">
        Continue
      </Button>
    </Card>
  );
};

export default Payment;
