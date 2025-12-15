import { useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Modal from '@/components/modal/modal';
import { useDepositTokens } from '@/lib/use-deposit-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useWithdrawTokens } from '@/lib/use-withdraw-tokens';
import { formatNumber } from '@/utils/formatters';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import styles from './balance.module.css';

const ETH_SEPOLIA_ADDRESS = '0xb16F35c0Ae2912430DAc15764477E179D9B9EbEa';

interface BalanceProps {
  admins: string[];
  peerId: string;
}

export const Balance = ({ admins, peerId }: BalanceProps) => {
  const { account, ocean } = useOceanAccount();
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

  const {
    isWithdrawing,
    handleWithdraw,
    error: withdrawError,
  } = useWithdrawTokens({
    onSuccess: () => {
      setIsWithdrawDialogOpen(false);
      setSelectedTokens([]);
      setTokenAmounts({});
    },
  });

  const [balances, setBalances] = useState<{ token: string; address: string; amount: number }[]>([]);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState<boolean>(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});

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
        tokenAddress: ETH_SEPOLIA_ADDRESS,
        amount: selectedAmount,
      });
    }
  };

  const handleWithdrawClick = () => {
    const tokenAddresses = selectedTokens
      .map((token) => balances.find((b) => b.token === token)?.address)
      .filter((addr): addr is string => !!addr);

    const amounts = selectedTokens.map((token) => tokenAmounts[token] || '0');

    if (tokenAddresses.length > 0 && amounts.every((amt) => parseFloat(amt) > 0)) {
      handleWithdraw({
        tokenAddresses,
        amounts,
      });
    }
  };

  const handleCloseModal = () => {
    if (!isDepositing) {
      setIsDialogOpen(false);
      setSelectedAmount('');
    }
  };

  const handleCloseWithdrawModal = () => {
    if (!isWithdrawing) {
      setIsWithdrawDialogOpen(false);
      setSelectedTokens([]);
      setTokenAmounts({});
    }
  };

  const handleTokenAmountChange = (token: string, value: string) => {
    setTokenAmounts((prev) => ({
      ...prev,
      [token]: value,
    }));
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
        <Modal isOpen={isWithdrawDialogOpen} onClose={handleCloseWithdrawModal} title="Withdraw funds" variant="solid">
          <div className={styles.modalContent}>
            <Select
              className={styles.balanceSelect}
              label="Select tokens"
              multiple={true}
              onChange={(e) => setSelectedTokens(e.target.value as string[])}
              options={balances.map((balance) => ({
                label: balance.token,
                value: balance.token,
              }))}
              value={selectedTokens}
              MenuProps={{ disablePortal: true, sx: { zIndex: 1000 } }}
            />
            {selectedTokens.map((token) => {
              const balance = balances.find((b) => b.token === token);
              return (
                <Input
                  key={token}
                  type="number"
                  value={tokenAmounts[token] || ''}
                  onChange={(e) => handleTokenAmountChange(token, e.target.value)}
                  placeholder="Enter amount"
                  label={`${token} amount`}
                  endAdornment={balance ? `Max: ${formatNumber(balance.amount)}` : token}
                />
              );
            })}
            <div className={styles.errorContainer}>
              {withdrawError && <div className={styles.errorMessage}>{withdrawError}</div>}
            </div>
            <Button
              className={styles.modalButton}
              color="accent2"
              disabled={
                !account.isConnected ||
                selectedTokens.length === 0 ||
                !selectedTokens.every((token) => tokenAmounts[token] && parseFloat(tokenAmounts[token]) > 0) ||
                isWithdrawing
              }
              loading={isWithdrawing}
              onClick={handleWithdrawClick}
              size="md"
            >
              {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
            </Button>
          </div>
        </Modal>
        {admins.includes(account?.address as string) && (
          <Button
            contentBefore={<UploadIcon />}
            size="md"
            onClick={() => setIsDialogOpen(true)}
            disabled={isDepositing || !ocean}
          >
            Send tokens for gas fee
          </Button>
        )}
        {admins.includes(account?.address as string) && (
          <Button
            color="accent2"
            contentBefore={<DownloadIcon />}
            disabled={!ocean || isWithdrawing}
            onClick={() => setIsWithdrawDialogOpen(true)}
            size="lg"
          >
            Withdraw funds
          </Button>
        )}
      </div>
    </Card>
  );
};
