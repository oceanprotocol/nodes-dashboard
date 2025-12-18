import { useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import styles from './balance.module.css';

interface BalanceProps {
  peerId: string;
}

export const Balance = ({ peerId }: BalanceProps) => {
  const { ocean } = useOceanAccount();

  const [balances, setBalances] = useState<[string, any][]>([]);

  useEffect(() => {
    ocean;
    ocean
      ?.getNodeBalance(peerId)
      .then((res) =>
        res.size === 0 ? setBalances([[`Failed to load balance`, null]]) : setBalances(Object.entries(res))
      );
  }, [ocean, peerId]);

  // TODO add button actions
  return (
    <Card className={styles.root} padding="sm" radius="md" variant="glass">
      <div className={styles.content}>
        <h3 className={styles.heading}>Node balance</h3>
        <div className={styles.list}>
          {balances.length >= 1 ? (
            balances.map((balance, index) => (
              <div className={styles.listItem} key={`${balance[0]}-${index}`}>
                <div>{balance[0]}</div>
                {balance[1] && <strong>{formatNumber(balance[1])}</strong>}
              </div>
            ))
          ) : (
            <div>No balance</div>
          )}
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
