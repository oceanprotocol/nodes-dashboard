import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { useOceanAccount } from '@/lib/use-ocean-account';
import FaucetArtifact from '@oceanprotocol/contracts/artifacts/contracts/grants/GrantsTokenFaucet.sol/GrantsTokenFaucet.json';
import { captureError } from '@/lib/analytics';
import { ClaimGrantResponse } from '@/types/grant';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';
import { useProfileContext } from '../../context/profile-context';
import styles from './claim.module.css';

const Claim: React.FC = () => {
  const { login } = usePrivy();

  const { account, sendTransaction, isSendingTransaction } = useOceanAccount();
  const { fetchGrantStatus } = useProfileContext();

  const [claimed, setClaimed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const tokenAmount = process.env.NEXT_PUBLIC_GRANT_AMOUNT;

  const handleClaim = async () => {
    // Fire in place (preserves the historical top-of-funnel count = raw button
    // clicks). `connected` lets us segment out clicks that just divert to login.
    posthog.capture('grant_claim_clicked', { connected: account.isConnected });
    if (!account.isConnected) {
      login();
      return;
    }
    try {
      setIsLoading(true);
      const response = await axios.post<ClaimGrantResponse>('/api/grant/claim', { walletAddress: account.address });
      const { faucetAddress, nonce, rawAmount, signature } = response.data;
      const data = encodeFunctionData({
        abi: FaucetArtifact.abi,
        functionName: 'claim',
        args: [account.address as `0x${string}`, BigInt(nonce), BigInt(rawAmount), signature as `0x${string}`],
      });
      sendTransaction({
        target: faucetAddress,
        data,
        onSuccess: async (result) => {
          try {
            await axios.post('/api/grant/confirm', {
              txHash: result.hash,
              walletAddress: account.address,
            });
            posthog.capture('grant_claim_success', {
              txHash: result.hash,
              amount: tokenAmount,
            });
            if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
              (window as any).gtag('event', 'conversion', {
                send_to: 'AW-17691004915/XkwpCJvEhfMbEPOf3fNB',
                value: 1.0,
                currency: 'USD',
                transaction_id: result.hash,
              });
            }
            setClaimed(true);
            fetchGrantStatus(account.address!);
            toast.success('Complimentary credits claimed successfully!');
          } catch (error) {
            console.error('Failed to confirm claim', error);
            toast.error('Transaction succeeded but failed to update status. Please contact support.');
          } finally {
            setIsLoading(false);
          }
        },
        onError: (error) => {
          setIsLoading(false);
          // On-chain claim tx failed / rejected.
          posthog.capture('grant_claim_failed', { error: String(error), reason: 'rpc_error' });
          console.error('Claim error:', error);
          toast.error('Failed to claim complimentary credits. Please try again.');
        },
      });
    } catch (error) {
      setIsLoading(false);
      // Failure fetching the claim voucher from /api/grant/claim — previously
      // silent (toast only). Categorise so ineligible vs already-claimed vs a
      // generic API error can be told apart in the funnel.
      let reason = 'api_error';
      if (axios.isAxiosError(error)) {
        const apiMessage = String(error.response?.data?.message ?? '').toLowerCase();
        if (apiMessage.includes('already') || apiMessage.includes('claimed')) {
          reason = 'already_claimed';
        } else if (apiMessage.includes('eligib') || error.response?.status === 403) {
          reason = 'ineligible';
        }
      }
      captureError('grant_claim_failed', error, { reason, error: String(error) });
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to initiate claim. Please try again.');
      }
      console.error('Failed to initiate claim', error);
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
      <div className={styles.group}>
        <h3>Verification successful</h3>
        <div>You are eligible to claim complimentary credits</div>
      </div>
      <Card className={styles.amountCard} radius="md" variant="accent1-outline">
        <h3>{claimed ? 'Claimed amount' : 'Claimable amount'}</h3>
        <div className={styles.values}>
          <span className={styles.token}>COMPY</span>
          &nbsp;
          <span className={styles.amount}>{tokenAmount}</span>
        </div>
      </Card>
      {claimed ? (
        <Button className="alignSelfStretch" color="accent1" href="/run-job/environments" size="lg" variant="filled">
          Select environment
        </Button>
      ) : (
        <Button
          autoLoading
          className="alignSelfStretch"
          color="accent1"
          loading={isLoading || isSendingTransaction}
          onClick={handleClaim}
          size="lg"
          variant="filled"
        >
          Claim grant
        </Button>
      )}
    </Card>
  );
};

export default Claim;
