import Button from '@/components/button/button';
import Card from '@/components/card/card';
import PaymentSummary from '@/components/run-job/payment-summary';
import { SelectedToken } from '@/context/run-job-context';
import { usePaySession } from '@/lib/use-pay-session';
import { computeEscrowRequirement, usePaymentInfo } from '@/lib/use-payment-info';
import { ComputeEnvironment } from '@/types/environments';
import { CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useMemo, useRef } from 'react';

type PaymentProps = {
  minLockSeconds: number;
  selectedEnv: ComputeEnvironment;
  selectedToken: SelectedToken;
  setPageSubtitle: (subtitle: string) => void;
  totalCost: number;
};

const Payment = ({ minLockSeconds, selectedEnv, selectedToken, setPageSubtitle, totalCost }: PaymentProps) => {
  const router = useRouter();

  // Escrow state (wallet/escrow balances + authorizations) — shared with the inference payment step.
  const {
    authorizations,
    escrowBalance,
    walletBalance,
    loading: loadingPaymentInfo,
    loadPaymentInfo,
  } = usePaymentInfo(selectedToken.address, selectedEnv.consumerAddress);

  // The payment-status effect below re-runs on every balance/auth refetch; without
  // this guard `payment_authorized` fires many times per session, inflating the
  // funnel above `payment_authorize`. Capture once per mount instead.
  const authorizedTracked = useRef(false);

  useEffect(() => {
    setPageSubtitle('Confirm and authorize your payment in order to start your job');
  }, [setPageSubtitle]);

  // Deposit + (re)authorization the session needs, and whether escrow already satisfies it.
  // Same helper as the inference step; run-job floors the lock window at 1s.
  const requirement = useMemo(
    () =>
      computeEscrowRequirement({
        snapshot: { authorizations, escrowBalance: escrowBalance ?? 0, walletBalance: walletBalance ?? 0 },
        totalCost,
        tokenAddress: selectedToken.address,
        requiredLockSeconds: minLockSeconds,
        minLockSecondsFloor: 1,
      }),
    [authorizations, escrowBalance, walletBalance, totalCost, selectedToken.address, minLockSeconds]
  );

  // Once escrow + authorization satisfy the session requirements, move on to the summary.
  useEffect(() => {
    if (requirement.sufficient) {
      if (!authorizedTracked.current) {
        authorizedTracked.current = true;
        posthog.capture('payment_authorized', {
          totalCost,
          tokenSymbol: selectedToken.symbol,
          tokenAddress: selectedToken.address,
          flow: 'run-job',
        });
      }
      router.push({ pathname: '/run-job/summary', query: router.query });
    }
  }, [requirement.sufficient, router, selectedToken.symbol, selectedToken.address, totalCost]);

  const { handlePay, isPaying } = usePaySession({ onSuccess: loadPaymentInfo });

  const handleSubmit = useCallback(
    () =>
      handlePay({
        flow: 'run-job',
        tokenAddress: selectedToken.address,
        peerId: selectedEnv.nodeId,
        spender: selectedEnv.consumerAddress,
        depositAmount: requirement.depositAmount.toString(),
        maxLockedAmount: requirement.maxLockedAmount.toString(),
        maxLockSeconds: requirement.maxLockSeconds.toString(),
        maxLockCount: requirement.maxLockCount.toString(),
      }),
    [handlePay, selectedToken.address, selectedEnv.nodeId, selectedEnv.consumerAddress, requirement]
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
          disabled={loadingPaymentInfo || isPaying || requirement.insufficientWalletFunds}
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
