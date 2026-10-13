import Button from '@/components/button/button';
import Card from '@/components/card/card';
import ProgressBar from '@/components/progress-bar/progress-bar';
import {
  SUBSIDY_DISCOUNT_PERCENT,
  SUBSIDY_ONE_TIME_CREDIT,
  SUBSIDY_TOKEN_SYMBOL,
  SUBSIDY_WEEKLY_DISCOUNT_LIMIT,
} from '@/constants/subsidy';
import { useProfileContext } from '@/context/profile-context';
import { captureError } from '@/lib/analytics';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSubsidyUsage } from '@/lib/use-subsidy';
import { GrantStatus } from '@/types/grant';
import { formatWalletAddress } from '@/utils/formatters';
import axios from 'axios';
import posthog from 'posthog-js';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './claim.module.css';
import subsidyStyles from './subsidy.module.css';

const percentUsed = (used: number, limit: number) => (limit > 0 ? (used / limit) * 100 : 0);

const ClaimedSubsidy = () => {
  const { data: usage } = useSubsidyUsage();

  const oneTimeUsed = usage?.oneTime.used ?? 0;
  const oneTimeLeft = usage?.oneTime.remaining ?? SUBSIDY_ONE_TIME_CREDIT;
  const discountUsed = usage?.discount.used ?? 0;

  return (
    <div className={styles.values}>
      <div className={styles.value}>
        <span className={subsidyStyles.bigValue}>
          {SUBSIDY_ONE_TIME_CREDIT}
          <span className={subsidyStyles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
        </span>
        <ProgressBar value={percentUsed(oneTimeUsed, SUBSIDY_ONE_TIME_CREDIT)} />
        <span className={styles.caption}>On us · {oneTimeLeft.toFixed(2)} left</span>
      </div>
      <div className={styles.value}>
        <span className={subsidyStyles.bigValue}>
          {SUBSIDY_WEEKLY_DISCOUNT_LIMIT}
          <span className={subsidyStyles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
        </span>
        <ProgressBar value={percentUsed(discountUsed, SUBSIDY_WEEKLY_DISCOUNT_LIMIT)} />
        <span className={styles.caption}>
          {SUBSIDY_DISCOUNT_PERCENT}% discount · {discountUsed.toFixed(2)} used this week
        </span>
      </div>
    </div>
  );
};

const Claim: React.FC = () => {
  const { account, login } = useOceanAccount();
  const { fetchGrantStatus, grantStatus } = useProfileContext();

  const [isLoading, setIsLoading] = useState(false);

  const isClaimed = grantStatus === GrantStatus.CLAIMED;

  const handleClaim = async () => {
    // `connected` lets us segment out clicks that just divert to login.
    posthog.capture('grant_claim_clicked', { connected: account.isConnected });
    if (!account.isConnected || !account.address) {
      login();
      return;
    }
    try {
      setIsLoading(true);
      await axios.post('/api/grant/claim', { walletAddress: account.address });
      posthog.capture('grant_claim_success');
      if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-17691004915/XkwpCJvEhfMbEPOf3fNB',
          value: 1.0,
          currency: 'USD',
          transaction_id: account.address,
        });
      }
      await fetchGrantStatus(account.address);
      toast.success('Subsidy claimed');
    } catch (error) {
      captureError('grant_claim_failed', error, { reason: 'api_error', error: String(error) });
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to claim subsidy. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={styles.root}
      direction="column"
      padding="md"
      radius="lg"
      shadow="black"
      spacing="lg"
      variant="glass-shaded"
    >
      <div className={styles.heading}>
        {isClaimed ? <span className="chip chipSuccess">Claimed</span> : null}
        <h3>{isClaimed ? 'Your subsidy is active' : 'Verification successful'}</h3>
        <span className={styles.muted}>
          {isClaimed
            ? 'Use it on jobs and models running on subsidized nodes'
            : 'You are eligible to claim the OPF subsidy'}
        </span>
      </div>
      <Card className={styles.amountCard} radius="sm" variant="accent1-outline">
        <span className={styles.muted}>Your subsidy for {formatWalletAddress(account.address ?? '')}</span>
        {isClaimed ? (
          <ClaimedSubsidy />
        ) : (
          <div className={styles.values}>
            <div className={styles.value}>
              <span className={subsidyStyles.bigValue}>
                {SUBSIDY_ONE_TIME_CREDIT}
                <span className={subsidyStyles.bigUnit}>{SUBSIDY_TOKEN_SYMBOL}</span>
              </span>
              <span className={styles.muted}>on us, one time</span>
            </div>
            <div className={styles.value}>
              <span className={subsidyStyles.bigValue}>{SUBSIDY_DISCOUNT_PERCENT}%</span>
              <span className={styles.muted}>
                discount on each job, up to {SUBSIDY_WEEKLY_DISCOUNT_LIMIT} {SUBSIDY_TOKEN_SYMBOL} / week
              </span>
            </div>
          </div>
        )}
      </Card>
      {isClaimed ? (
        <div className={styles.actions}>
          <Button color="accent2" href="/inference" size="md" variant="filled">
            Use a model
          </Button>
          <Button color="accent1" href="/run-job/environments" size="md" variant="filled">
            Run a job
          </Button>
        </div>
      ) : (
        <>
          <span className={styles.note}>
            Claiming adds your wallet to the subsidy contract. The subsidy is paid up front when a job starts, so that
            part never needs to be in your escrow.
          </span>
          <Button
            className="alignSelfCenter"
            color="accent1"
            loading={isLoading}
            onClick={handleClaim}
            size="lg"
            variant="filled"
          >
            Claim subsidy
          </Button>
        </>
      )}
    </Card>
  );
};

export default Claim;
