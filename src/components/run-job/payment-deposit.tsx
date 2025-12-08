import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { useOceanContext } from '@/context/ocean-context';
import { SelectedToken } from '@/context/run-job-context';
import { useFormik } from 'formik';
import { useState } from 'react';
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
  const { depositTokens } = useOceanContext();

  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);

  const formik = useFormik<DepositFormValues>({
    initialValues: {
      amount: totalCost - escrowBalance,
    },
    onSubmit: async (values) => {
      try {
        setIsLoadingSubmit(true);
        const tx = await depositTokens(selectedToken.address, values.amount.toString());
        await tx.wait();
        loadPaymentInfo();
        // toast.success('Deposit successful!');
      } catch (error) {
        console.error('Deposit failed:', error);
        // toast.error('Deposit failed');
      } finally {
        setIsLoadingSubmit(false);
      }
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
      <Button className="alignSelfEnd" color="accent2" loading={isLoadingSubmit} size="lg" type="submit">
        Deposit
      </Button>
    </form>
  );
};

export default PaymentDeposit;
