import Card from '@/components/card/card';
import PaymentAuthorize from '@/components/run-job/payment-authorize';
import PaymentDeposit from '@/components/run-job/payment-deposit';
import PaymentFiatTopup from '@/components/run-job/payment-fiat-topup';
import PaymentSummary from '@/components/run-job/payment-summary';
import { getSupportedTokens } from '@/constants/tokens';
import { SelectedToken } from '@/context/run-job-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { Authorizations } from '@/types/payment';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PaymentProps = {
  minLockSeconds: number;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  selectedToken: SelectedToken;
  totalCost: number;
};

const Payment = ({ minLockSeconds, selectedEnv, selectedResources, selectedToken, totalCost }: PaymentProps) => {
  const router = useRouter();

  const { account, ocean } = useOceanAccount();

  const [authorizations, setAuthorizations] = useState<Authorizations | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingPaymentInfo, setLoadingPaymentInfo] = useState(false);

  const currentLockedAmount = Number(authorizations?.currentLockedAmount ?? 0);

  const step: 'topup' | 'deposit' | 'authorize' = useMemo(() => {
    if (
      (walletBalance ?? 0) + (escrowBalance ?? 0) - currentLockedAmount < totalCost &&
      selectedToken.address === getSupportedTokens().USDC
    ) {
      // Only USDC can be topped up with fiat
      return 'topup';
    }
    if ((escrowBalance ?? 0) - currentLockedAmount < totalCost) {
      return 'deposit';
    }
    return 'authorize';
  }, [currentLockedAmount, escrowBalance, selectedToken.address, totalCost, walletBalance]);

  const loadPaymentInfo = useCallback(async () => {
    if (ocean && account?.address) {
      setLoadingPaymentInfo(true);
      const authorizations = await ocean.getAuthorizations(
        selectedToken.address,
        account.address,
        selectedEnv.consumerAddress
      );
      setAuthorizations(authorizations);
      const walletBalance = await ocean.getBalance(selectedToken.address, account.address);
      setWalletBalance(Number(walletBalance));
      const escrowBalance = await ocean.getUserFunds(selectedToken.address, account.address);
      setEscrowBalance(Number(escrowBalance));
      setLoadingPaymentInfo(false);
    }
  }, [ocean, account.address, selectedToken.address, selectedEnv.consumerAddress]);

  useEffect(() => {
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  useEffect(() => {
    const sufficientEscrow = (escrowBalance ?? 0) + currentLockedAmount >= totalCost;
    const suffficientAuthorized = (Number(authorizations?.maxLockedAmount) ?? 0) >= totalCost + currentLockedAmount;
    const enoughLockSeconds = (Number(authorizations?.maxLockSeconds) ?? 0) >= selectedResources.maxJobDurationHours;
    if (sufficientEscrow && suffficientAuthorized && enoughLockSeconds) {
      router.push('/run-job/summary');
    }
  }, [
    authorizations?.maxLockSeconds,
    authorizations?.maxLockedAmount,
    currentLockedAmount,
    escrowBalance,
    router,
    selectedResources.maxJobDurationHours,
    totalCost,
  ]);

  const renderStep = () => {
    switch (step) {
      case 'topup': {
        return (
          <PaymentFiatTopup
            currentLockedAmount={currentLockedAmount}
            escrowBalance={escrowBalance ?? 0}
            loadingPaymentInfo={loadingPaymentInfo}
            loadPaymentInfo={loadPaymentInfo}
            selectedToken={selectedToken}
            totalCost={totalCost}
            walletBalance={walletBalance ?? 0}
          />
        );
      }
      case 'deposit': {
        return (
          <PaymentDeposit
            currentLockedAmount={currentLockedAmount}
            escrowBalance={escrowBalance ?? 0}
            loadingPaymentInfo={loadingPaymentInfo}
            loadPaymentInfo={loadPaymentInfo}
            selectedToken={selectedToken}
            totalCost={totalCost}
            walletBalance={walletBalance ?? 0}
          />
        );
      }
      case 'authorize': {
        return (
          <PaymentAuthorize
            currentLockedAmount={currentLockedAmount}
            loadingPaymentInfo={loadingPaymentInfo}
            loadPaymentInfo={loadPaymentInfo}
            minLockSeconds={minLockSeconds}
            selectedEnv={selectedEnv}
            selectedToken={selectedToken}
            totalCost={totalCost}
          />
        );
      }
      default:
        return null;
    }
  };

  return loadingPaymentInfo && (escrowBalance === null || walletBalance === null) ? (
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
      {renderStep()}
    </Card>
  );
};

export default Payment;
