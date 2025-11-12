import { OceanProvider } from '@/lib/OceanProvider';
import { useAppKitProvider, type Provider } from '@reown/appkit/react';
import { BrowserProvider } from 'ethers';
import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { BASE_CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import styles from './balance.module.css';

interface BalanceProps {
  nodeUrl: string;
}

export const Balance = ({ nodeUrl }: BalanceProps) => {
  const [balances, setBalances] = useState<[string, any][]>([]);
  const chainId = process.env.NODE_ENV === 'production' ? BASE_CHAIN_ID : ETH_SEPOLIA_CHAIN_ID;
  const { walletProvider } = useAppKitProvider<Provider>('eip155');

  const provider = useMemo(() => {
    if (!walletProvider || !chainId) return null;
    return new BrowserProvider(walletProvider, chainId);
  }, [walletProvider, chainId]);

  const ocean = useMemo(() => {
    if (!provider || !chainId) return null;
    return new OceanProvider(Number(chainId), provider);
  }, [provider, chainId]);

  useEffect(() => {
    console.log('ocean: ', ocean);
    if (ocean) {
      ocean
        .getNodeBalance(nodeUrl)
        .then((res) =>
          res.size === 0
            ? setBalances([[`Failed to call node balance for url: ${nodeUrl}`, null]])
            : setBalances(Object.entries(res))
        );
    }
  }, [nodeUrl, ocean]);

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
