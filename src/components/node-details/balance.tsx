import { useCallback, useEffect, useMemo, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import GasFeeModal from '@/components/node-details/gas-fee-modal';
import WithdrawModal from '@/components/node-details/withdraw-modal';
import { useP2P } from '@/contexts/P2PContext';
import { getTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import { CircularProgress } from '@mui/material';
import { toast } from 'react-toastify';
import styles from './balance.module.css';

interface BalanceProps {
  admins: string[];
}

export const Balance = ({ admins }: BalanceProps) => {
  const { account, ocean } = useOceanAccount();
  const { envs, isReady } = useP2P();

  const [escrowBalances, setEscrowBalances] = useState<NodeBalance[]>([]);
  const [isGasFeeModalOpen, setIsGasFeeModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [loadingEscrowBalances, setLoadingEscrowBalances] = useState<boolean>(false);
  const [loadingNodeBalances, setLoadingNodeBalances] = useState<boolean>(false);
  const [nodeBalances, setNodeBalances] = useState<NodeBalance[]>([]);

  const isAdmin = useMemo(() => admins.includes(account?.address as string), [admins, account]);

  const loadEscrowBalances = useCallback(async () => {
    if (!ocean) {
      return;
    }
    setLoadingEscrowBalances(true);
    try {
      if (account?.address && envs.length > 0) {
        const uniqueTokens = new Set<string>();
        envs.forEach((env) => {
          if (env.fees) {
            Object.values(env.fees).forEach((feeStructures) => {
              feeStructures.forEach((fee) => {
                uniqueTokens.add(fee.feeToken);
              });
            });
          }
        });
        const userBalances: NodeBalance[] = await Promise.all(
          Array.from(uniqueTokens).map(async (tokenAddress) => {
            const symbol = await getTokenSymbol(tokenAddress);
            const balance = await ocean.getUserFunds(tokenAddress, account.address!);
            return {
              token: symbol || tokenAddress,
              address: tokenAddress,
              amount: Number(balance),
            };
          })
        );
        setEscrowBalances(userBalances.filter((b) => b.amount > 0));
      } else {
        setEscrowBalances([]);
      }
    } catch (error) {
      toast.error('Error loading escrow balance');
      console.error('Error loading balances:', error);
    } finally {
      setLoadingEscrowBalances(false);
    }
  }, [ocean, account?.address, envs]);

  const loadNodeBalances = useCallback(async () => {
    if (!ocean || !isAdmin) {
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
  }, [ocean, envs, isAdmin]);

  useEffect(() => {
    loadEscrowBalances();
    loadNodeBalances();
  }, [loadEscrowBalances, loadNodeBalances]);

  useEffect(() => {
    if (ocean && isAdmin) {
      setLoadingNodeBalances(true);
      ocean.getNodeBalance(envs).then((res) => {
        res.length === 0 ? setNodeBalances([]) : setNodeBalances(res);
        setLoadingNodeBalances(false);
      });
    }
  }, [ocean, envs, isAdmin]);

  const hasAnyEscrowBalance = useMemo(() => escrowBalances.some((b) => b.amount > 0), [escrowBalances]);

  return (
    <Card className={styles.root} padding="sm" radius="md" variant="glass">
      <div className={styles.content}>
        {ocean && isAdmin ? (
          <>
            <h3 className={styles.heading}>Node balance</h3>
            <div className={styles.list}>
              {loadingNodeBalances ? (
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
          </>
        ) : null}
        <h3 className={styles.heading}>Escrow balance</h3>
        <div className={styles.list}>
          {!ocean ? (
            <div>Log in to see your funds in escrow</div>
          ) : loadingEscrowBalances || !isReady ? (
            <CircularProgress className="alignSelfCenter" size={27} />
          ) : escrowBalances.length >= 1 ? (
            escrowBalances.map((balance, index) => (
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
            <GasFeeModal isOpen={isGasFeeModalOpen} onClose={() => setIsGasFeeModalOpen(false)} />
          </>
        ) : null}
        {ocean && hasAnyEscrowBalance ? (
          <>
            <Button
              color="accent2"
              contentBefore={<DownloadIcon />}
              loading={loadingEscrowBalances}
              onClick={() => setIsWithdrawModalOpen(true)}
              size="lg"
            >
              Withdraw escrow funds
            </Button>
            <WithdrawModal
              balances={escrowBalances}
              isOpen={isWithdrawModalOpen}
              onClose={() => {
                setIsWithdrawModalOpen(false);
                loadEscrowBalances();
              }}
            />
          </>
        ) : null}
      </div>
    </Card>
  );
};
