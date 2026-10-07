import { useCallback, useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GasFeeModal from '@/components/node-details/gas-fee-modal';
import WithdrawModal from '@/components/node-details/withdraw-modal';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment } from '@/types/environments';
import { NodeBalance } from '@/types/nodes';
import { formatNumber } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import { toast } from 'react-toastify';
import styles from './balance.module.css';

const BALANCE_REFRESH_ATTEMPTS = 10;
const BALANCE_REFRESH_INTERVAL_MS = 2000;

interface BalanceProps {
  envs: ComputeEnvironment[];
  nodeUri: NodeUri;
}

export const Balance: React.FC<BalanceProps> = ({ envs, nodeUri }) => {
  const { ocean } = useOceanAccount();
  const { isReady } = useP2P();

  const [isGasFeeModalOpen, setIsGasFeeModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [loadingNodeBalances, setLoadingNodeBalances] = useState<boolean>(false);
  const [nodeBalances, setNodeBalances] = useState<NodeBalance[]>([]);

  const loadNodeBalances = useCallback(async () => {
    if (!ocean) {
      return;
    }
    try {
      setLoadingNodeBalances(true);
      const res = await ocean.getNodeBalance(envs);
      setNodeBalances(res ?? []);
    } catch (error) {
      toast.error('Error loading node balance');
      console.error('Error loading balances:', error);
    } finally {
      setLoadingNodeBalances(false);
    }
  }, [ocean, envs]);

  useEffect(() => {
    loadNodeBalances();
  }, [loadNodeBalances]);

  const reloadUntilChanged = useCallback(async () => {
    if (!ocean) {
      return;
    }
    const previous = JSON.stringify(nodeBalances);
    setLoadingNodeBalances(true);
    try {
      for (let attempt = 1; attempt <= BALANCE_REFRESH_ATTEMPTS; attempt++) {
        const res = (await ocean.getNodeBalance(envs)) ?? [];
        const changed = res.length > 0 && JSON.stringify(res) !== previous;
        if (changed || attempt === BALANCE_REFRESH_ATTEMPTS) {
          setNodeBalances(res);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, BALANCE_REFRESH_INTERVAL_MS));
      }
    } catch (error) {
      toast.error('Error loading node balance');
      console.error('Error loading balances:', error);
    } finally {
      setLoadingNodeBalances(false);
    }
  }, [ocean, envs, nodeBalances]);

  const withdrawableBalances = nodeBalances.filter((balance) => balance.amount > 0);

  return (
    <Card className={styles.root} padding="sm" radius="md" innerShadow="black" variant="glass">
      <div className={styles.content}>
        <h3 className={styles.heading}>Node balance</h3>
        <div className={styles.list}>
          {loadingNodeBalances || !isReady ? (
            <CircularProgress className="alignSelfCenter" size={27} />
          ) : nodeBalances.length >= 1 ? (
            nodeBalances.map((balance, index) => (
              <div className={styles.listItem} key={`${balance.token}-${index}`}>
                <div>{balance.token}</div>
                {balance.amount !== undefined && <strong>{formatNumber(balance.amount)}</strong>}
              </div>
            ))
          ) : (
            <div>No funds</div>
          )}
        </div>
      </div>
      <div className={styles.buttons}>
        <Button
          color="accent1"
          disabled={!ocean}
          onClick={() => setIsGasFeeModalOpen(true)}
          size="md"
          variant="outlined"
        >
          Send tokens for gas fee
        </Button>
        <GasFeeModal
          isOpen={isGasFeeModalOpen}
          nodeAddress={envs[0]?.consumerAddress ?? ''}
          onClose={() => setIsGasFeeModalOpen(false)}
          onSuccess={reloadUntilChanged}
        />
        <Button
          color="accent1"
          disabled={!isReady || withdrawableBalances.length === 0}
          onClick={() => setIsWithdrawModalOpen(true)}
          size="lg"
          variant="filled"
        >
          Withdraw
        </Button>
        <WithdrawModal
          balances={withdrawableBalances}
          isOpen={isWithdrawModalOpen}
          nodeUri={nodeUri}
          onClose={() => setIsWithdrawModalOpen(false)}
          onSuccess={reloadUntilChanged}
        />
      </div>
    </Card>
  );
};
