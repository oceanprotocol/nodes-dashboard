import { useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useDepositTokens } from '@/lib/use-deposit-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import styles from './balance.module.css';

interface BalanceProps {
  peerId: string;
}

export const Balance = ({ peerId }: BalanceProps) => {
  const { ocean } = useOceanAccount();
  const {
    isDepositing,
    handleDeposit,
    error: depositError,
  } = useDepositTokens({
    onSuccess: () => {
      setIsDialogOpen(false);
      setSelectedAmount('');
    },
  });

  const [balances, setBalances] = useState<{ token: string; amount: number }[]>([]);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    if (ocean && peerId) {
      setLoadingBalance(true);

      ocean.getNodeBalance(peerId).then((res) => {
        res.length === 0 ? setBalances([]) : setBalances(res);
        setLoadingBalance(false);
      });
    }
  }, [ocean, peerId]);

  const handleSend = () => {
    if (selectedAmount) {
      handleDeposit({
        tokenAddress: '0xb16F35c0Ae2912430DAc15764477E179D9B9EbEa',
        amount: selectedAmount,
      });
    }
  };

  const handleCloseModal = () => {
    if (!isDepositing) {
      setIsDialogOpen(false);
      setSelectedAmount('');
    }
  };

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
        <Modal isOpen={isDialogOpen} onClose={handleCloseModal} title="Send tokens for gas fee" variant="solid">
          <div className={styles.modalContent}>
            <Input
              type="number"
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(e.target.value)}
              placeholder="Enter amount"
              label="Amount"
              endAdornment="ETH"
            />
            <div className={styles.errorContainer}>
              {depositError && <div className={styles.errorMessage}>{depositError}</div>}
            </div>
            <Button
              className={styles.modalButton}
              color="accent1"
              disabled={!selectedAmount || isDepositing}
              loading={isDepositing}
              onClick={handleSend}
              size="md"
            >
              {isDepositing ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </Modal>
        <Button
          contentBefore={<UploadIcon />}
          size="md"
          onClick={() => setIsDialogOpen(true)}
          disabled={isDepositing || !ocean}
        >
          Send tokens for gas fee
        </Button>
        <Button color="accent2" contentBefore={<DownloadIcon />} disabled={!ocean} size="lg">
          Withdraw funds
        </Button>
      </div>
    </Card>
  );
};
