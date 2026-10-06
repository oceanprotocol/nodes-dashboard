import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TransferModal from '@/components/profile/transfer-modal';
import { getExplorerUrl } from '@/constants/chains';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useTransferHistory } from '@/lib/use-transfer-history';
import {
  DEFAULT_TOPUP_USDC,
  FiatTopupError,
  getTopupErrorMessage,
  TOPUP_USER_EXITED,
  useUsdcArrival,
  useUsdcTopup,
} from '@/lib/use-usdc-topup';
import { useWalletBalances } from '@/lib/use-wallet-balances';
import { formatNumber, formatWalletAddress } from '@/utils/formatters';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import SendIcon from '@mui/icons-material/Send';
import { CircularProgress } from '@mui/material';
import { toast } from 'react-toastify';
import styles from './consumer-balance.module.css';

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copied to clipboard');
};

const PAGE_SIZE = 5;
const NON_TRANSFERABLE_TOKENS = ['COMPY'];

const ConsumerBalance = () => {
  const { account, ocean } = useOceanAccount();
  const { balances, loading: loadingBalances, refetch: refetchBalances } = useWalletBalances();
  const { transfers, loading: loadingHistory, refetch: refetchHistory } = useTransferHistory();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);

  // Card top-up (Privy fiat on-ramp): USDC on Base, delivered straight to the smart account.
  const { canTopup, scaAddress, topup } = useUsdcTopup();
  const { watch: watchUsdcArrival, watching: waitingForUsdc } = useUsdcArrival(scaAddress, {
    onArrived: (delta) => {
      toast.success(`${delta} USDC arrived in your wallet`);
      refetchBalances();
      refetchHistory();
    },
    onTimeout: () => toast.info('Your top-up is still processing. Your balance will update once it arrives.'),
  });

  const handleTopup = async () => {
    setIsToppingUp(true);
    try {
      const { result } = await topup({ amountUsdc: DEFAULT_TOPUP_USDC, destination: 'sca', source: 'profile' });
      if (result === 'confirmed') {
        toast.success('Payment received. Your USDC is on its way, usually within a few minutes.');
      } else {
        toast.info('Purchase submitted. Your USDC will appear here once it arrives.');
      }
      watchUsdcArrival();
    } catch (error) {
      const code = error instanceof FiatTopupError ? error.code : undefined;
      // Closing Privy's modal is a choice, not a failure.
      if (code !== TOPUP_USER_EXITED) {
        toast.error(getTopupErrorMessage(code));
      }
    } finally {
      setIsToppingUp(false);
    }
  };

  // COMPY is not transferable between wallets.
  const transferableBalances = useMemo(
    () => balances.filter((balance) => !NON_TRANSFERABLE_TOKENS.includes(balance.token)),
    [balances]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const isConnected = mounted && !!ocean;

  const explorerUrl = getExplorerUrl();

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <div className={styles.header}>
        <h3>Account balance</h3>
        <div className={styles.headerActions}>
          {isConnected && canTopup && (
            <Button
              color="accent1"
              contentBefore={isToppingUp ? null : <CreditCardIcon />}
              loading={isToppingUp}
              onClick={handleTopup}
              size="md"
              variant="outlined"
            >
              Top up
            </Button>
          )}
          {isConnected && transferableBalances.length > 0 && (
            <Button
              color="accent1"
              contentBefore={<SendIcon />}
              onClick={() => setIsTransferModalOpen(true)}
              size="md"
              variant="outlined"
            >
              Transfer
            </Button>
          )}
        </div>
      </div>

      {waitingForUsdc && <p className={styles.topupHint}>Waiting for your USDC to arrive on Base…</p>}

      <div className={styles.balanceList}>
        {!isConnected ? (
          <div className={styles.emptyState}>Log in to see your balance</div>
        ) : loadingBalances ? (
          <CircularProgress className="alignSelfCenter" size={27} />
        ) : balances.length > 0 ? (
          balances.map((balance) => (
            <div className={styles.balanceItem} key={balance.token}>
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
                    color="accent1"
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
                    color="accent1"
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
          balances={transferableBalances}
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
