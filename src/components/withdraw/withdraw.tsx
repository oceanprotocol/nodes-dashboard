import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import DownloadIcon from '@mui/icons-material/Download';
import classNames from 'classnames';
import styles from './withdraw.module.css';

// TODO replace mock data

const Withdraw = () => {
  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <Card className={styles.balance} radius="md" variant="accent1-outline">
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
      <Input endAdornment="OCEAN" label="Amount" type="number" />
      <Button className={styles.nextButton} color="accent1" contentBefore={<DownloadIcon />} size="lg">
        Withdraw
      </Button>
    </Card>
  );
};

export default Withdraw;
