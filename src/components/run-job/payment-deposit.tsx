import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { SelectedToken } from '@/context/run-job-context';
import { useDepositTokens } from '@/lib/use-deposit-tokens';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './payment-deposit.module.css';

type DepositFormValues = {
  amount: number;
};

type PaymentDepositProps = {
  // currentLockedAmount: number;
  escrowBalance: number;
  loadingPaymentInfo: boolean;
  loadPaymentInfo: () => void;
  renderBackButton?: (disabled: boolean) => React.ReactNode;
  selectedToken: SelectedToken;
  totalCost: number;
  walletBalance: number;
};

const PaymentDeposit = ({
  // currentLockedAmount,
  escrowBalance,
  loadingPaymentInfo,
  loadPaymentInfo,
  renderBackButton,
  selectedToken,
  totalCost,
  walletBalance,
}: PaymentDepositProps) => {
  const { handleDeposit, isDepositing } = useDepositTokens({ onSuccess: loadPaymentInfo });

  const amountToDeposit = Math.max(0, totalCost - escrowBalance);
  const hasSufficientFunds = escrowBalance >= totalCost;

  const formik = useFormik<DepositFormValues>({
    enableReinitialize: true,
    initialValues: {
      amount: amountToDeposit,
    },
    onSubmit: async (values) => {
      handleDeposit({
        tokenAddress: selectedToken.address,
        amount: values.amount.toString(),
      });
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number().required('Required').min(0, 'Invalid amount'),
    }),
  });

  return (
    <form className={styles.root} onSubmit={formik.handleSubmit}>
      <Input
        endAdornment={selectedToken.symbol}
        errorText={formik.touched.amount && formik.errors.amount ? formik.errors.amount : undefined}
        label="Amount to deposit"
        name="amount"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        step="any"
        type="number"
        value={formik.values.amount}
      />
      <div className={styles.buttons}>
        {renderBackButton?.(loadingPaymentInfo)}
        {hasSufficientFunds ? (
          <Button
            autoLoading
            color="accent1"
            disabled={loadingPaymentInfo || isDepositing}
            onClick={loadPaymentInfo}
            size="lg"
            type="button"
          >
            Continue
          </Button>
        ) : (
          <Button
            color="accent1"
            disabled={isDepositing || walletBalance < amountToDeposit}
            loading={isDepositing}
            size="lg"
            type="submit"
          >
            Deposit
          </Button>
        )}
      </div>
    </form>
  );
};

export default PaymentDeposit;
