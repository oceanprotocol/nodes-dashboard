import Card from '@/components/card/card';
import PaymentAuthorize from '@/components/run-job/payment-authorize';
import PaymentDeposit from '@/components/run-job/payment-deposit';
import PaymentSummary from '@/components/run-job/payment-summary';
import { SelectedToken } from '@/context/run-job-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { Authorizations } from '@/types/payment';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PaymentProps = {
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  selectedToken: SelectedToken;
  totalCost: number;
  peerId: string;
};

const Payment = ({ peerId, selectedEnv, selectedResources, selectedToken, totalCost }: PaymentProps) => {
  const router = useRouter();

  const { account, ocean } = useOceanAccount();

  const [authorizations, setAuthorizations] = useState<Authorizations | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [loadingAuthorizations, setLoadingAuthorizations] = useState(false);
  const [loadingUserFunds, setLoadingUserFunds] = useState(false);

  const step: 'authorize' | 'deposit' = useMemo(() => {
    if ((escrowBalance ?? 0) >= totalCost) {
      return 'authorize';
    }
    return 'deposit';
  }, [escrowBalance, totalCost]);

  const loadPaymentInfo = useCallback(() => {
    if (ocean && account?.address) {
      setLoadingAuthorizations(true);
      ocean
        .getAuthorizations(selectedToken.address, account.address, selectedEnv.consumerAddress)
        .then((authorizations) => {
          setAuthorizations(authorizations);
          setLoadingAuthorizations(false);
        });
      ocean.getBalance(selectedToken.address, account.address).then((balance) => {
        setWalletBalance(Number(balance));
      });
      setLoadingUserFunds(true);
      ocean.getUserFunds(selectedToken.address, account.address).then((balance) => {
        setEscrowBalance(Number(balance));
        setLoadingUserFunds(false);
      });
    }
  }, [ocean, account.address, selectedToken.address, selectedEnv.consumerAddress]);

  useEffect(() => {
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  useEffect(() => {
    const sufficientEscrow = (escrowBalance ?? 0) >= totalCost;
    const suffficientAuthorized = (Number(authorizations?.maxLockedAmount) ?? 0) >= totalCost;
    const enoughLockSeconds = (Number(authorizations?.maxLockSeconds) ?? 0) >= selectedResources.maxJobDurationHours;
    if (sufficientEscrow && suffficientAuthorized && enoughLockSeconds) {
      router.push('/run-job/summary');
    }
  }, [
    authorizations?.maxLockSeconds,
    authorizations?.maxLockedAmount,
    escrowBalance,
    router,
    selectedResources.maxJobDurationHours,
    totalCost,
  ]);

  return loadingAuthorizations || loadingUserFunds ? (
    <CircularProgress />
  ) : (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Payment</h3>
      <PaymentSummary
        authorizations={authorizations}
        escrowBalance={escrowBalance ?? 0}
        tokenSymbol={selectedToken.symbol}
        totalCost={totalCost}
        walletBalance={walletBalance ?? 0}
      />
      {step === 'deposit' ? (
        <PaymentDeposit
          escrowBalance={escrowBalance ?? 0}
          loadPaymentInfo={loadPaymentInfo}
          selectedToken={selectedToken}
          totalCost={totalCost}
        />
      ) : step === 'authorize' ? (
        <PaymentAuthorize
          // authorizations={authorizations}
          loadingAuthorizations={loadingAuthorizations}
          loadPaymentInfo={loadPaymentInfo}
          selectedEnv={selectedEnv}
          selectedResources={selectedResources}
          selectedToken={selectedToken}
          totalCost={totalCost}
          peerId={peerId}
        />
      ) : null}
    </Card>
  );
};

export default Payment;
