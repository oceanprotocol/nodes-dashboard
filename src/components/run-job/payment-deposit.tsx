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
  escrowBalance: number;
  loadPaymentInfo: () => void;
  selectedToken: SelectedToken;
  totalCost: number;
};

const PaymentDeposit = ({ escrowBalance, loadPaymentInfo, selectedToken, totalCost }: PaymentDepositProps) => {
  const { handleDeposit, isDepositing } = useDepositTokens({ onSuccess: loadPaymentInfo });

  const formik = useFormik<DepositFormValues>({
    enableReinitialize: true,
    initialValues: {
      amount: totalCost - escrowBalance,
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
        type="number"
        value={formik.values.amount}
      />
      <Button className="alignSelfEnd" color="accent2" loading={isDepositing} size="lg" type="submit">
        Deposit
      </Button>
    </form>
  );
};

export default PaymentDeposit;
