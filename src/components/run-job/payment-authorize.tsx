import AuthorizationForm from '@/components/escrow/authorization-form';
import Button from '@/components/button/button';
import { SelectedToken } from '@/context/run-job-context';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { ComputeEnvironment } from '@/types/environments';
import { roundTokenAmount } from '@/utils/formatters';

type PaymentAuthorizeProps = {
  currentLockedAmount: number;
  loadingPaymentInfo: boolean;
  loadPaymentInfo: () => void;
  minLockSeconds: number;
  renderBackButton?: (disabled: boolean) => React.ReactNode;
  selectedEnv: ComputeEnvironment;
  selectedToken: SelectedToken;
  totalCost: number;
};

const PaymentAuthorize = ({
  currentLockedAmount,
  loadingPaymentInfo,
  loadPaymentInfo,
  minLockSeconds,
  renderBackButton,
  selectedEnv,
  selectedToken,
  totalCost,
}: PaymentAuthorizeProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess: loadPaymentInfo });

  return (
    <AuthorizationForm
      initialValues={{
        maxLockedAmount: roundTokenAmount(totalCost + currentLockedAmount, selectedToken.address, 'up'),
        maxLockCount: 10,
        // Min lock seconds is the minimum number of seconds for the lock.
        // Job duration + claimTimeout, computed and set with initializeCompute.
        maxLockSeconds: minLockSeconds < 1 ? 1 : Math.ceil(minLockSeconds),
      }}
      loading={loadingPaymentInfo || isAuthorizing}
      minLockSeconds={minLockSeconds}
      onSubmit={(values) =>
        handleAuthorize({
          tokenAddress: selectedToken.address,
          peerId: selectedEnv.nodeId,
          spender: selectedEnv.consumerAddress,
          maxLockedAmount: values.maxLockedAmount.toString(),
          maxLockSeconds: values.maxLockSeconds.toString(),
          maxLockCount: values.maxLockCount.toString(),
        })
      }
      renderSecondaryAction={renderBackButton}
      renderSubmitButton={({ disabled, loading }) => (
        <Button color="accent1" disabled={disabled} loading={loading} size="lg" type="submit">
          Authorize
        </Button>
      )}
      tokenSymbol={selectedToken.symbol}
    />
  );
};

export default PaymentAuthorize;
