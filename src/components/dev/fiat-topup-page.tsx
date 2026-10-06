import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import Input from '@/components/input/input';
import SectionTitle from '@/components/section-title/section-title';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  BASE_CAIP2,
  BASE_USDC,
  FiatTopupError,
  MAX_TOPUP_USDC,
  ONRAMP_ENVIRONMENT,
  useBaseUsdcBalance,
  useUsdcTopup,
  type TopupDestination,
} from '@/lib/use-usdc-topup';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits } from 'viem';
import styles from './fiat-topup-page.module.css';

const POLL_INTERVAL_MS = 5000;
const POLL_DURATION_MS = 3 * 60 * 1000;

type LogEntry = { at: string; event: string } & Record<string, unknown>;

type AddLog = (event: string, data?: Record<string, unknown>) => void;

const formatUsdc = (value: bigint) => formatUnits(value, BASE_USDC.decimals);

// Logs every change of one wallet's balance. The first read for an address is the baseline, not a change.
const useBalanceChangeLog = (
  wallet: TopupDestination,
  address: string | undefined,
  balance: bigint | undefined,
  addLog: AddLog
) => {
  const previous = useRef<{ address?: string; balance?: bigint }>({});

  useEffect(() => {
    if (balance === undefined) return;
    const before = previous.current.address === address ? previous.current.balance : undefined;
    previous.current = { address, balance };
    if (before === undefined || before === balance) return;
    addLog(balance > before ? 'balance_increased' : 'balance_decreased', {
      wallet,
      address,
      before: formatUsdc(before),
      after: formatUsdc(balance),
      delta: formatUsdc(balance - before),
    });
  }, [addLog, address, balance, wallet]);
};

const FiatTopupPage = () => {
  const { user } = useOceanAccount();
  const { canTopup, embeddedWallet, scaAddress, topup } = useUsdcTopup();

  const [amount, setAmount] = useState('10');
  const [destination, setDestination] = useState<TopupDestination>('sca');
  const [isBuying, setIsBuying] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pollUntil, setPollUntil] = useState<number | null>(null);

  const addLog = useCallback<AddLog>((event, data = {}) => {
    setLog((entries) => [{ at: new Date().toISOString(), event, ...data }, ...entries]);
  }, []);

  const refetchInterval = pollUntil === null ? undefined : POLL_INTERVAL_MS;
  const scaBalance = useBaseUsdcBalance(scaAddress, { refetchInterval });
  const embeddedBalance = useBaseUsdcBalance(embeddedWallet?.address, { refetchInterval });

  useBalanceChangeLog('sca', scaAddress, scaBalance.balance, addLog);
  useBalanceChangeLog('embedded', embeddedWallet?.address, embeddedBalance.balance, addLog);

  useEffect(() => {
    if (pollUntil === null) return;
    const timer = setTimeout(() => {
      setPollUntil(null);
      addLog('poll_finished', { afterSeconds: POLL_DURATION_MS / 1000 });
    }, pollUntil - Date.now());
    return () => clearTimeout(timer);
  }, [addLog, pollUntil]);

  const amountValue = Number(amount);
  const amountError =
    amount === '' || !(amountValue > 0) || amountValue > MAX_TOPUP_USDC
      ? `Enter an amount between 1 and ${MAX_TOPUP_USDC}`
      : undefined;

  const handleBuy = async () => {
    setIsBuying(true);
    addLog('topup_started', { destination, requestedAmount: amountValue });
    try {
      const result = await topup({ amountUsdc: amountValue, destination, source: 'dev_page' });
      addLog('topup_result', { ...result, destination });
    } catch (error) {
      addLog('topup_error', {
        code: error instanceof FiatTopupError ? error.code : undefined,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsBuying(false);
      // Whatever fund() returned, the chain is the source of truth: watch both wallets for the USDC.
      addLog('poll_started', {
        everySeconds: POLL_INTERVAL_MS / 1000,
        forSeconds: POLL_DURATION_MS / 1000,
        sca: scaBalance.formatted,
        embedded: embeddedBalance.formatted,
      });
      setPollUntil(Date.now() + POLL_DURATION_MS);
    }
  };

  const refreshBalances = async () => {
    await Promise.all([scaBalance.refetch(), embeddedBalance.refetch()]);
  };

  const renderBalance = (balance: ReturnType<typeof useBaseUsdcBalance>) => {
    if (balance.error) return <span className={styles.error}>{balance.error.message}</span>;
    if (balance.formatted === undefined) return '…';
    return `${balance.formatted} USDC`;
  };

  return (
    <Container className="pageRoot">
      <SectionTitle
        title="Card top-up (spike)"
        subTitle="Internal test page for Privy's fiat on-ramp: card → USDC on Base. Not linked from the app."
      />
      <div className={styles.root}>
        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
          <h3 className={styles.heading}>Account</h3>
          <dl className={styles.details}>
            <dt>User type</dt>
            <dd>{user?.type ?? '—'}</dd>
            <dt>Smart account (SCA)</dt>
            <dd className={styles.mono}>{scaAddress ?? '—'}</dd>
            <dt>SCA USDC on Base</dt>
            <dd>{scaAddress ? renderBalance(scaBalance) : '—'}</dd>
            <dt>Embedded EOA (signer)</dt>
            <dd className={styles.mono}>{embeddedWallet?.address ?? '—'}</dd>
            <dt>Embedded connectorType</dt>
            <dd className={styles.mono}>{embeddedWallet?.connectorType ?? '—'}</dd>
            <dt>Embedded EOA USDC on Base</dt>
            <dd>{embeddedWallet ? renderBalance(embeddedBalance) : '—'}</dd>
            <dt>On-ramp</dt>
            <dd className={styles.mono}>
              {BASE_CAIP2} · {ONRAMP_ENVIRONMENT}
            </dd>
          </dl>
          <div>
            <Button
              autoLoading
              color="accent1"
              contentBefore={<RefreshIcon />}
              disabled={!scaAddress && !embeddedWallet}
              onClick={refreshBalances}
              size="md"
              variant="outlined"
            >
              Refresh balances
            </Button>
          </div>
          {pollUntil !== null ? (
            <p className={styles.hint}>
              Polling both balances every {POLL_INTERVAL_MS / 1000}s until {new Date(pollUntil).toLocaleTimeString()}.
            </p>
          ) : null}
        </Card>

        {user?.type === 'eoa' ? (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="warning">
            <p>Not available for external wallets.</p>
          </Card>
        ) : null}

        {canTopup ? (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
            <h3 className={styles.heading}>Buy USDC</h3>
            <Input
              errorText={amountError}
              hint={`Rounded up to whole USDC, max ${MAX_TOPUP_USDC}. Sandbox: card 4242 4242 4242 4242, any CVC, future expiry, under $200.`}
              label="Amount (USDC)"
              max={MAX_TOPUP_USDC}
              min={1}
              onChange={(e) => setAmount(e.target.value)}
              step={1}
              type="number"
              value={amount}
            />
            <fieldset className={styles.destinations}>
              <legend>Destination</legend>
              <label>
                <input
                  checked={destination === 'sca'}
                  name="destination"
                  onChange={() => setDestination('sca')}
                  type="radio"
                  value="sca"
                />
                Smart account (SCA)
              </label>
              <label>
                <input
                  checked={destination === 'embedded'}
                  disabled={!embeddedWallet}
                  name="destination"
                  onChange={() => setDestination('embedded')}
                  type="radio"
                  value="embedded"
                />
                Embedded EOA (signer)
              </label>
            </fieldset>
            <div>
              <Button
                color="accent1"
                contentBefore={<CreditCardIcon />}
                disabled={!!amountError}
                loading={isBuying}
                onClick={handleBuy}
                size="lg"
                variant="filled"
              >
                Buy USDC with card
              </Button>
            </div>
          </Card>
        ) : null}

        <Card direction="column" padding="md" radius="lg" shadow="black" spacing="sm" variant="glass-shaded">
          <div className={styles.logHeader}>
            <h3 className={styles.heading}>Log</h3>
            <Button color="primary" disabled={log.length === 0} onClick={() => setLog([])} size="sm" variant="outlined">
              Clear
            </Button>
          </div>
          {log.length === 0 ? (
            <p className={styles.hint}>Results, errors and balance changes show up here, newest first.</p>
          ) : (
            <pre className={styles.log}>{log.map((entry) => JSON.stringify(entry)).join('\n')}</pre>
          )}
        </Card>
      </div>
    </Container>
  );
};

export default FiatTopupPage;
