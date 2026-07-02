import useInferenceAllocation from '@/components/hooks/use-inference-allocation';
import PaymentSummary from '@/components/run-job/payment-summary';
import { SelectedInferenceEnv } from '@/context/inference-context';
import { SelectedToken } from '@/context/run-job-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { Authorizations } from '@/types/payment';
import { roundTokenAmount } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

type InferencePaymentProps = {
  selectedEnv: SelectedInferenceEnv;
  selectedToken: SelectedToken;
  durationSeconds: number;
};

const InferencePayment = ({ selectedEnv, selectedToken, durationSeconds }: InferencePaymentProps) => {
  const { account, ocean } = useOceanAccount();
  const environment = selectedEnv.environment;
  const tokenAddress = selectedToken.address;

  const [authorizations, setAuthorizations] = useState<Authorizations | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { price } = useInferenceAllocation({
    environment,
    tokenAddress,
    gpuSelection: selectedEnv.gpuSelection,
    durationSeconds,
  });

  // Round up so float noise never under-quotes the required balance/allowance.
  const totalCost = useMemo(() => roundTokenAmount(price, tokenAddress, 'up'), [price, tokenAddress]);

  const loadPaymentInfo = useCallback(async () => {
    if (!ocean || !account?.address) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const auth = await ocean.getAuthorizations(tokenAddress, account.address, environment.consumerAddress);
      setAuthorizations(auth);
      const wallet = await ocean.getBalance(tokenAddress, account.address);
      setWalletBalance(roundTokenAmount(Number(wallet), tokenAddress, 'down'));
      const escrow = await ocean.getUserFunds(tokenAddress, account.address);
      setEscrowBalance(roundTokenAmount(Number(escrow), tokenAddress, 'down'));
    } catch (err) {
      setAuthorizations(null);
      setWalletBalance(null);
      setEscrowBalance(null);
      setLoadError(err instanceof Error ? err.message : 'Failed to load payment info.');
    } finally {
      setLoading(false);
    }
  }, [ocean, account?.address, tokenAddress, environment.consumerAddress]);

  useEffect(() => {
    loadPaymentInfo();
  }, [loadPaymentInfo]);

  if (loading && escrowBalance === null && walletBalance === null) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  if (loadError) {
    return <div className="textAccent1">{loadError}</div>;
  }

  return (
    <PaymentSummary
      authorizations={authorizations}
      escrowBalance={escrowBalance ?? 0}
      loadPaymentInfo={loadPaymentInfo}
      selectedToken={selectedToken}
      totalCost={totalCost}
      walletBalance={walletBalance ?? 0}
    />
  );
};

export default InferencePayment;
