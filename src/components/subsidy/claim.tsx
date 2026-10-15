import Button from '@/components/button/button';
import Card from '@/components/card/card';
import SubsidyTiles from '@/components/subsidy/subsidy-tiles';
import { useProfileContext } from '@/context/profile-context';
import { captureError } from '@/lib/analytics';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { SubsidyStatus } from '@/types/subsidy';
import { formatWalletAddress } from '@/utils/formatters';
import axios from 'axios';
import posthog from 'posthog-js';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './claim.module.css';

const Claim: React.FC = () => {
  const { account, login } = useOceanAccount();
  const { fetchSubsidyStatus, subsidyStatus } = useProfileContext();

  const [isLoading, setIsLoading] = useState(false);

  const isClaimed = subsidyStatus === SubsidyStatus.CLAIMED;

  const handleClaim = async () => {
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
    <Card className={styles.root} direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h3>{isClaimed ? 'Your subsidy is active' : 'Claim your subsidy'}</h3>
          <span className="chip chipSuccess">{isClaimed ? 'Claimed' : 'Email verified'}</span>
        </div>
        <span className={styles.muted}>
          {isClaimed ? 'Use it on jobs and models running on supported nodes.' : 'Activate it for wallet '}
          {isClaimed ? null : <span className={styles.wallet}>{formatWalletAddress(account.address ?? '')}</span>}
        </span>
      </div>
      <SubsidyTiles />
      {isClaimed ? (
        <div className="actionsGroupLgEnd">
          <Button color="accent1" href="/run-job/environments" size="lg" variant="outlined">
            Run a job
          </Button>
          <Button color="accent1" href="/inference" size="lg" variant="filled">
            Use a model
          </Button>
        </div>
      ) : (
        <div className="actionsGroupLgBetween">
          <span className={styles.note}>
            The subsidy is paid when a job starts, so only your share needs to be in escrow.
          </span>
          <Button color="accent1" loading={isLoading} onClick={handleClaim} size="lg" variant="filled">
            Claim subsidy
          </Button>
        </div>
      )}
    </Card>
  );
};

export default Claim;
