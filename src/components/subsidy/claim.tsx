import Button from '@/components/button/button';
import Card from '@/components/card/card';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import SubsidyTiles from '@/components/subsidy/subsidy-tiles';
import { useProfileContext } from '@/context/profile-context';
import { captureError } from '@/lib/analytics';
import { formatSubsidyPeriod, getBindingWindow } from '@/lib/subsidy';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSubsidyProgram, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
import { formatWalletAddress } from '@/utils/formatters';
import axios from 'axios';
import posthog from 'posthog-js';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './claim.module.css';
import subsidyStyles from './subsidy.module.css';

const percentUsed = (used: number, limit: number) => (limit > 0 ? (used / limit) * 100 : 0);

const ClaimedSubsidy = () => {
  const { data: program } = useSubsidyProgram();
  const { data: usage } = useSubsidyUsage();

  if (!program) {
    return null;
  }

  const discountWindow = getBindingWindow(usage?.discount?.windows ?? program.discount?.windows ?? []);

  return (
    <div className={styles.values}>
      {program.oneTime ? (
        <div className={styles.value}>
          <span className={subsidyStyles.bigValue}>{formatSubsidyTokenAmount(program.oneTime.credit)}</span>
          <ProgressBar value={percentUsed(usage?.oneTime?.used ?? 0, program.oneTime.credit)} />
          <span className={styles.caption}>
            On us · {formatSubsidyAmount(usage?.oneTime?.remaining ?? program.oneTime.credit)} left
          </span>
        </div>
      ) : null}
      {program.discount ? (
        <div className={styles.value}>
          <span className={subsidyStyles.bigValue}>{formatSubsidyAmount(program.discount.percent)}% off</span>
          {discountWindow ? (
            <>
              <ProgressBar value={percentUsed(discountWindow.used, discountWindow.limit)} />
              <span className={styles.caption}>
                {formatSubsidyAmount(discountWindow.used)} of {formatSubsidyTokenAmount(discountWindow.limit)} used this{' '}
                {formatSubsidyPeriod(discountWindow.periodSeconds)}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Claim: React.FC = () => {
  const { account, login } = useOceanAccount();
  const { fetchSubsidyStatus, subsidyStatus } = useProfileContext();

  const [isLoading, setIsLoading] = useState(false);

  const isClaimed = subsidyStatus === SubsidyStatus.CLAIMED;

  const handleClaim = async () => {
    // `connected` lets us segment out clicks that just divert to login.
    posthog.capture('grant_claim_clicked', { connected: account.isConnected });
    if (!account.isConnected || !account.address) {
      login();
      return;
    }
    try {
      setIsLoading(true);
      await axios.post('/api/subsidy/claim', { walletAddress: account.address });
      posthog.capture('grant_claim_success');
      if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-17691004915/XkwpCJvEhfMbEPOf3fNB',
          value: 1.0,
          currency: 'USD',
          transaction_id: account.address,
        });
      }
      await fetchSubsidyStatus(account.address);
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
        {isClaimed ? <ClaimedSubsidy /> : <SubsidyTiles />}
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
