import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GasFeeModal from '@/components/node-details/gas-fee-modal';
import WithdrawModal from '@/components/node-details/withdraw-modal';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import styles from './balance.module.css';

interface BalanceProps {
  admins: string[];
  peerId: string;
}

export const Balance = ({ admins, peerId }: BalanceProps) => {
  const { account, ocean } = useOceanAccount();

  const [balances, setBalances] = useState<NodeBalance[]>([]);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [isGasFeeModalOpen, setIsGasFeeModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);

  const isAdmin = useMemo(() => admins.includes(account?.address as string), [admins, account]);

  useEffect(() => {
    if (ocean && peerId) {
      setLoadingBalance(true);

      ocean.getNodeBalance(peerId).then((res) => {
        res.length === 0 ? setBalances([]) : setBalances(res);
        setLoadingBalance(false);
      });
    }
  }, [ocean, peerId]);

  return (
    <Card className={styles.root} padding="sm" radius="md" variant="glass">
      <div className={styles.content}>
        <h3 className={styles.heading}>Node balance</h3>
        <div className={styles.list}>
          {!ocean ? (
            <div>Connect your wallet to see node balance</div>
          ) : loadingBalance ? (
            <div>Fetching data...</div>
          ) : balances.length >= 1 ? (
            balances.map((balance, index) => (
              <div className={styles.listItem} key={`${balance.token}-${index}`}>
                <div>{balance.token}</div>
                {balance.amount && <strong>{formatNumber(balance.amount)}</strong>}
              </div>
            ))
          ) : (
            <div>No balance</div>
          )}
        </div>
      </div>
      <div className={styles.buttons}>
        {isAdmin ? (
          <>
            <Button
              color="accent2"
              disabled={!ocean}
              onClick={() => setIsGasFeeModalOpen(true)}
              size="md"
              variant="outlined"
            >
              Send tokens for gas fee
            </Button>
            <Button
              color="accent2"
              contentBefore={<DownloadIcon />}
              disabled={!ocean}
              onClick={() => setIsWithdrawModalOpen(true)}
              size="lg"
            >
              Withdraw funds
            </Button>
          </>
        ) : null}
        <GasFeeModal isOpen={isGasFeeModalOpen} onClose={() => setIsGasFeeModalOpen(false)} />
        <WithdrawModal balances={balances} isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} />
      </div>
    </Card>
  );
};
