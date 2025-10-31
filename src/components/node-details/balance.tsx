import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import styles from './balance.module.css';

// TODO replace mock data
const MOCK_ENVS = [
  {
    id: 0,
    name: 'Environment 1',
    token: 'OCEAN',
    amount: 1200.5,
  },
  {
    id: 1,
    name: 'Environment 2',
    token: 'USDC',
    amount: 9051.5,
  },
];

export const Balance = () => {
  // TODO add button actions
  return (
    <Card className={styles.root} padding="sm" radius="md" variant="glass">
      <div className={styles.content}>
        <h3 className={styles.heading}>Node balance</h3>
        <div className={styles.list}>
          {MOCK_ENVS.map((env) => (
            <div className={styles.listItem} key={env.id}>
              <div>{env.token}</div>
              <strong>{formatNumber(env.amount)}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.buttons}>
        <a>Send tokens for gas fee</a>
        <Button color="accent2" contentBefore={<DownloadIcon />} size="lg">
          Withdraw funds
        </Button>
      </div>
    </Card>
  );
};
