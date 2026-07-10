import Button from '@/components/button/button';
import Card from '@/components/card/card';
import PaymentSummary from '@/components/run-job/payment-summary';
import { SelectedToken } from '@/context/run-job-context';
import { usePaymentInfo } from '@/lib/use-payment-info';
import { DEFAULT_MAX_LOCK_COUNT, usePaySession } from '@/lib/use-pay-session';
import { ComputeEnvironment } from '@/types/environments';
import { roundTokenAmount } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect } from 'react';

type PaymentProps = {
  minLockSeconds: number;
  selectedEnv: ComputeEnvironment;
  selectedToken: SelectedToken;
  setPageSubtitle: (subtitle: string) => void;
  totalCost: number;
};

const Payment = ({
  minLockSeconds,
  selectedEnv,
  selectedToken,
  setPageSubtitle,
  totalCost,
}: PaymentProps) => {
  const router = useRouter();

  const {
    authorizations,
    escrowBalance,
    walletBalance,
    loading: loadingPaymentInfo,
    loadPaymentInfo,
  } = usePaymentInfo(selectedToken.address, selectedEnv.consumerAddress);

  const currentLockedAmount = Number(authorizations?.currentLockedAmount ?? 0);

  useEffect(() => {
    setPageSubtitle('Confirm and authorize your payment in order to start your job');
  }, [setPageSubtitle]);

  // Once escrow + authorization satisfy the session requirements, move on to the summary.
  useEffect(() => {
    const sufficientEscrow = (escrowBalance ?? 0) >= totalCost;
    const suffficientAuthorized =
      roundTokenAmount(Number(authorizations?.maxLockedAmount ?? 0), selectedToken.address) >=
      roundTokenAmount(totalCost + currentLockedAmount, selectedToken.address);
    const enoughLockSeconds = Number(authorizations?.maxLockSeconds ?? 0) >= minLockSeconds;
    const hasAvailableLockSlot = Number(authorizations?.currentLocks ?? 0) < Number(authorizations?.maxLockCounts ?? 0);
    if (sufficientEscrow && suffficientAuthorized && enoughLockSeconds && hasAvailableLockSlot) {
      posthog.capture('payment_authorized', {
        totalCost,
        tokenSymbol: selectedToken.symbol,
        tokenAddress: selectedToken.address,
      });
      router.push({ pathname: '/run-job/summary', query: router.query });
    }
  }, [
    authorizations?.currentLocks,
    authorizations?.maxLockCounts,
    authorizations?.maxLockSeconds,
    authorizations?.maxLockedAmount,
    currentLockedAmount,
    escrowBalance,
    minLockSeconds,
    router,
    selectedToken.address,
    selectedToken.symbol,
    totalCost,
  ]);

  const { handlePay, isPaying } = usePaySession({ onSuccess: loadPaymentInfo });

  const depositAmount = roundTokenAmount(
    Math.max(0, totalCost - (escrowBalance ?? 0)),
    selectedToken.address,
    'up'
  );
  const maxLockedAmount = roundTokenAmount(totalCost + currentLockedAmount, selectedToken.address, 'up');
  const maxLockSeconds = minLockSeconds < 1 ? 1 : Math.ceil(minLockSeconds);
  // Escrow's authorize SETS (not increments) the lock cap. Derive above the current locks so a user
  // who has already used all their slots can still raise the limit and start a new session. Include
  // the existing cap so a higher limit set on the escrow page isn't silently shrunk on re-auth.
  const maxLockCount = Math.max(
    DEFAULT_MAX_LOCK_COUNT,
    Number(authorizations?.currentLocks ?? 0) + 1,
    Number(authorizations?.maxLockCounts ?? 0)
  );

  const insufficientWalletFunds = (walletBalance ?? 0) < depositAmount;

  const handleSubmit = useCallback(
    () =>
      handlePay({
        tokenAddress: selectedToken.address,
        peerId: selectedEnv.nodeId,
        spender: selectedEnv.consumerAddress,
        depositAmount: depositAmount.toString(),
        maxLockedAmount: maxLockedAmount.toString(),
        maxLockSeconds: maxLockSeconds.toString(),
        maxLockCount: maxLockCount.toString(),
      }),
    [
      handlePay,
      selectedToken.address,
      selectedEnv.nodeId,
      selectedEnv.consumerAddress,
      depositAmount,
      maxLockedAmount,
      maxLockSeconds,
      maxLockCount,
    ]
  );

  return loadingPaymentInfo && (escrowBalance === null || walletBalance === null) ? (
    <CircularProgress className="alignSelfCenter" />
  ) : (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Payment</h3>
      <PaymentSummary
        authorizations={authorizations}
        escrowBalance={escrowBalance ?? 0}
        loadPaymentInfo={loadPaymentInfo}
        selectedToken={selectedToken}
        totalCost={totalCost}
        walletBalance={walletBalance ?? 0}
      />
      <div className="actionsGroupLgBetween">
        <Button
          color="accent1"
          disabled={loadingPaymentInfo || isPaying}
          onClick={() => router.replace({ pathname: '/run-job/resources', query: router.query })}
          size="lg"
          type="button"
          variant="transparent"
        >
          Edit resources
        </Button>
        <Button
          color="accent1"
          disabled={loadingPaymentInfo || isPaying || insufficientWalletFunds}
          loading={isPaying}
          onClick={handleSubmit}
          size="lg"
          type="button"
        >
          Authorize &amp; start session
        </Button>
      </div>
    </Card>
  );
};

export default Payment;
