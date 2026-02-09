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
  currentLockedAmount: number;
  escrowBalance: number;
  loadPaymentInfo: () => void;
  selectedToken: SelectedToken;
  totalCost: number;
};

const PaymentDeposit = ({
  currentLockedAmount,
  escrowBalance,
  loadPaymentInfo,
  selectedToken,
  totalCost,
}: PaymentDepositProps) => {
  const { handleDeposit, isDepositing } = useDepositTokens({ onSuccess: loadPaymentInfo });

  const amountToDeposit = Math.max(0, totalCost - escrowBalance);
  const hasSufficientFunds = escrowBalance - currentLockedAmount >= totalCost;

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

  const handleContinue = () => {
    loadPaymentInfo();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (hasSufficientFunds) {
      e.preventDefault();
      handleContinue();
    } else {
      formik.handleSubmit(e);
    }
  };

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <Input
        endAdornment={selectedToken.symbol}
        errorText={formik.touched.amount && formik.errors.amount ? formik.errors.amount : undefined}
        label="Amount to deposit"
        name="amount"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        type="number"
        value={formik.values.amount}
      />
      {hasSufficientFunds ? (
        <Button className="alignSelfEnd" color="accent2" size="lg" type="submit">
          Continue
        </Button>
      ) : (
        <Button className="alignSelfEnd" color="accent2" loading={isDepositing} size="lg" type="submit">
          Deposit
        </Button>
      )}
    </form>
  );
};

export default PaymentDeposit;
