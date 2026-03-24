import Button from '@/components/button/button';
import Card from '@/components/card/card';
import FaucetAbi from '@/constants/abis/faucet.json';
import { useTokenSymbol } from '@/lib/token-symbol';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ClaimGrantResponse, GrantDetails } from '@/types/grant';
import { useAuthModal } from '@account-kit/react';
import axios from 'axios';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { encodeFunctionData } from 'viem';
import { useProfileContext } from '../../context/profile-context';
import styles from './claim.module.css';

type ClaimProps = {
  grantDetails: GrantDetails;
};

const Claim: React.FC<ClaimProps> = ({ grantDetails }) => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();

  const { account, sendTransaction, isSendingTransaction } = useOceanAccount();
  const { fetchGrantStatus } = useProfileContext();

  const [claimed, setClaimed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const tokenAmount = process.env.NEXT_PUBLIC_GRANT_AMOUNT;
  const tokenSymbol = useTokenSymbol(process.env.NEXT_PUBLIC_GRANT_TOKEN_ADDRESS);

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  const handleClaim = async () => {
    posthog.capture('grant_claim_clicked');
    if (!account.isConnected) {
      openAuthModal();
      return;
    }
    try {
      setIsLoading(true);
      const response = await axios.post<ClaimGrantResponse>('/api/grant/claim', { walletAddress: account.address });
      const { faucetAddress, nonce, rawAmount, signature } = response.data;
      const data = encodeFunctionData({
        abi: FaucetAbi,
        functionName: 'claim',
        args: [
          grantDetails.walletAddress as `0x${string}`,
          BigInt(nonce),
          BigInt(rawAmount),
          signature as `0x${string}`,
        ],
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
            setClaimed(true);
            fetchGrantStatus(account.address!);
            toast.success('Grant claimed successfully!');
          } catch (error) {
            console.error('Failed to confirm claim', error);
            toast.error('Transaction succeeded but failed to update status. Please contact support.');
          } finally {
            setIsLoading(false);
          }
        },
        onError: (error) => {
          setIsLoading(false);
          posthog.capture('grant_claim_failed', { error: String(error) });
          console.error('Claim error:', error);
          toast.error('Failed to claim grant. Please try again.');
        },
      });
    } catch (error) {
      setIsLoading(false);
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
        <div>You are eligible for grant distribution</div>
      </div>
      <Card className={styles.amountCard} radius="md" variant="accent1-outline">
        <h3>{claimed ? 'Claimed amount' : 'Claimable amount'}</h3>
        <div className={styles.values}>
          <span className={styles.token}>{tokenSymbol}</span>
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
