import { useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { useOceanContext } from '@/context/ocean-context';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import styles from './balance.module.css';

interface BalanceProps {
  nodeUrl: string;
}

export const Balance = ({ nodeUrl }: BalanceProps) => {
  const { getNodeBalance } = useOceanContext();

  const [balances, setBalances] = useState<[string, any][]>([]);

  useEffect(() => {
    getNodeBalance(nodeUrl).then((res) =>
      res.size === 0
        ? setBalances([[`Failed to call node balance for url: ${nodeUrl}`, null]])
        : setBalances(Object.entries(res))
    );
  }, [getNodeBalance, nodeUrl]);

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
