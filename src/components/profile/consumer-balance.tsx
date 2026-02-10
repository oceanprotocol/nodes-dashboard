import { useEffect, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TransferModal from '@/components/profile/transfer-modal';
import { BASE_CHAIN_ID, CHAIN_ID, ETH_SEPOLIA_CHAIN_ID } from '@/constants/chains';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useTransferHistory } from '@/lib/use-transfer-history';
import { useWalletBalances } from '@/lib/use-wallet-balances';
import { formatNumber, formatWalletAddress } from '@/utils/formatters';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import { CircularProgress } from '@mui/material';
import { toast } from 'react-toastify';
import styles from './consumer-balance.module.css';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

const PAGE_SIZE = 5;

const getExplorerUrl = () => {
  if (CHAIN_ID === BASE_CHAIN_ID) return 'https://basescan.org';
  if (CHAIN_ID === ETH_SEPOLIA_CHAIN_ID) return 'https://sepolia.etherscan.io';
  return 'https://etherscan.io';
};

const ConsumerBalance = () => {
  const { account, ocean } = useOceanAccount();
  const { balances, loading: loadingBalances, refetch: refetchBalances } = useWalletBalances();
  const { transfers, loading: loadingHistory, refetch: refetchHistory } = useTransferHistory();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isConnected = mounted && !!ocean;

  const explorerUrl = getExplorerUrl();

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Account balance</h3>
        {isConnected && (
          <Button
            color="accent2"
            contentBefore={<SendIcon />}
            onClick={() => setIsTransferModalOpen(true)}
            size="md"
            variant="outlined"
          >
            Transfer
          </Button>
        )}
      </div>

      <div className={styles.balanceList}>
        {!isConnected ? (
          <div className={styles.emptyState}>Log in to see your balance</div>
        ) : loadingBalances ? (
          <CircularProgress className="alignSelfCenter" size={27} />
        ) : balances.length > 0 ? (
          balances.map((balance, index) => (
            <div className={styles.balanceItem} key={`${balance.token}-${index}`}>
              <div>{balance.token}</div>
              <strong>{formatNumber(balance.amount)}</strong>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>No tokens found</div>
        )}
      </div>

      {isConnected && (
        <div className={styles.historySection}>
          <h3>Tokens transfer history</h3>
          {loadingHistory ? (
            <CircularProgress className="alignSelfCenter" size={27} />
          ) : transfers.length > 0 ? (
            <>
              <div className={styles.historyTable}>
                <div className={styles.historyHeader}>
                  <span>Token</span>
                  <span>From</span>
                  <span>To</span>
                  <span>Amount</span>
                  <span>Tx</span>
                </div>
                {transfers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((transfer, index) => (
                  <div className={styles.historyRow} key={`${transfer.txHash}-${index}`}>
                    <span>{transfer.tokenSymbol}</span>
                    <span className={styles.addressCell} title={transfer.from}>
                      {transfer.from.toLowerCase() === account.address?.toLowerCase()
                        ? 'You'
                        : formatWalletAddress(transfer.from)}
                      <button
                        className={styles.copyButton}
                        onClick={() => copyToClipboard(transfer.from)}
                        type="button"
                        aria-label="Copy from address"
                      >
                        <ContentCopyIcon className={styles.copyIcon} />
                      </button>
                    </span>
                    <span className={styles.addressCell} title={transfer.to}>
                      {transfer.to.toLowerCase() === account.address?.toLowerCase()
                        ? 'You'
                        : formatWalletAddress(transfer.to)}
                      <button
                        className={styles.copyButton}
                        onClick={() => copyToClipboard(transfer.to)}
                        type="button"
                        aria-label="Copy to address"
                      >
                        <ContentCopyIcon className={styles.copyIcon} />
                      </button>
                    </span>
                    <span>{transfer.amount}</span>
                    <a
                      className={styles.txLink}
                      href={`${explorerUrl}/tx/${transfer.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {formatWalletAddress(transfer.txHash)}
                    </a>
                  </div>
                ))}
              </div>
              {transfers.length > PAGE_SIZE && (
                <div className={styles.pagination}>
                  <Button
                    color="accent2"
                    contentBefore={<ChevronLeftIcon />}
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    size="sm"
                    variant="outlined"
                  >
                    Prev
                  </Button>
                  <span className={styles.pageInfo}>
                    {page + 1} / {Math.ceil(transfers.length / PAGE_SIZE)}
                  </span>
                  <Button
                    color="accent2"
                    contentAfter={<ChevronRightIcon />}
                    disabled={(page + 1) * PAGE_SIZE >= transfers.length}
                    onClick={() => setPage((p) => p + 1)}
                    size="sm"
                    variant="outlined"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>No transfers found</div>
          )}
        </div>
      )}

      {isConnected && (
        <TransferModal
          balances={balances}
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            refetchBalances();
            refetchHistory();
          }}
        />
      )}
    </Card>
  );
};

export default ConsumerBalance;
