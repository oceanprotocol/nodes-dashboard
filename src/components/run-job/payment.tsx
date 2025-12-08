import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useOceanContext } from '@/context/ocean-context';
import { SelectedToken } from '@/context/run-job-context';
import { formatNumber } from '@/utils/formatters';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { useAppKitAccount } from '@reown/appkit/react';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import styles from './payment.module.css';

// TODO replace mock data

type PaymentProps = {
  selectedToken: SelectedToken;
  totalCost: number;
};

const Payment = ({ selectedToken, totalCost }: PaymentProps) => {
  const account = useAppKitAccount();

  const { getBalance, getUserFunds } = useOceanContext();

  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (account?.address) {
      getBalance(selectedToken.address, account.address).then(({ balance }) => {
        setWalletBalance(Number(balance));
      });
      getUserFunds(selectedToken.address, account.address).then((balance) => {
        setEscrowBalance(Number(balance));
      });
    }
  }, [account.address, getBalance, getUserFunds, selectedToken.address]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Payment</h3>
      {escrowBalance !== null && escrowBalance < totalCost ? (
        <Card className={styles.insufficientFunds} padding="sm" radius="md" variant="error">
          <HighlightOffIcon className={styles.icon} />
          <h3>Insufficient funds</h3>
          <div className={styles.message}>You do not have enough funds deposited in the escrow contract</div>
        </Card>
      ) : null}
      <Card className={styles.cost} radius="md" variant="accent1-outline">
        <h3>Estimated total cost</h3>
        <div className={styles.values}>
          <span className={styles.token}>{selectedToken.symbol}</span>
          &nbsp;
          <span className={styles.amount}>{formatNumber(totalCost)}</span>
        </div>
        <h3>User available funds in escrow</h3>
        <div className={styles.values}>
          <span className={styles.token}>{selectedToken.symbol}</span>
          &nbsp;
          <span className={styles.amount}>{formatNumber(escrowBalance ?? 0)}</span>
        </div>
        <h3 className={styles.sm}>User available funds in wallet</h3>
        <div className={classNames(styles.values, styles.sm)}>
          <span className={styles.token}>{selectedToken.symbol}</span>
          &nbsp;
          <span className={classNames(styles.amount, styles.sm)}>{formatNumber(walletBalance ?? 0)}</span>
        </div>
      </Card>
      <form className={styles.form}>
        <Card direction="column" padding="sm" radius="md" spacing="md" variant="glass">
          <div className={styles.row}>
            {/* <Select label="Fee token address" /> */}
            <Input endAdornment={selectedToken.symbol} label="Amount" type="number" />
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
