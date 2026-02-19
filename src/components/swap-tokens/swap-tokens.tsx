import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { getSupportedTokens } from '@/constants/tokens';
import { useSwapTokens } from '@/lib/use-swap-tokens';
import { useWalletBalances } from '@/lib/use-wallet-balances';
import { formatNumber } from '@/utils/formatters';
import { useFormik } from 'formik';
import { useMemo } from 'react';
import * as Yup from 'yup';
import styles from './swap-tokens.module.css';

type SwapTokensProps = {
  onCancel?: () => void;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  refetchOnSuccess?: boolean;
};

type SwapTokensFormValues = {
  amount: number | '';
};

const SwapTokens: React.FC<SwapTokensProps> = ({ onCancel, onError, onSuccess, refetchOnSuccess }) => {
  const { balances, loading: loadingBalances, refetch: refetchBalances } = useWalletBalances();
  const { handleSwap, isSwapping } = useSwapTokens({
    onSuccess: async () => {
      if (refetchOnSuccess) {
        await refetchBalances();
      }
      onSuccess?.();
    },
    onError: (error: any) => {
      onError?.(error);
    },
  });

  const filteredBalances = useMemo(() => {
    const supportedTokens = [getSupportedTokens().USDC.toLowerCase(), getSupportedTokens().COMPY.toLowerCase()];
    return [...balances].filter((b) => supportedTokens.includes(b.address.toLowerCase()));
  }, [balances]);

  const usdcBalance = useMemo(() => {
    return filteredBalances.find((b) => b.token === 'USDC')?.amount ?? 0;
  }, [filteredBalances]);

  const formik = useFormik<SwapTokensFormValues>({
    initialValues: {
      amount: '',
    },
    onSubmit: async (values) => {
      await handleSwap({ amount: values.amount.toString() });
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      amount: Yup.number()
        .required('Amount is required')
        .min(0, 'Amount must be greater than 0')
        .max(usdcBalance, 'Insufficient USDC balance'),
    }),
  });

  return (
    <>
      <Card className={styles.balancesCard} radius="md" variant="accent1-outline">
        <h3>Available balance</h3>
        {loadingBalances
          ? 'Loading available balance...'
          : filteredBalances?.length > 0
            ? filteredBalances.map((balance) => (
                <div className={styles.balanceItem} key={balance.token}>
                  <div>{balance.token}</div>
                  <strong>{formatNumber(balance.amount)}</strong>
                </div>
              ))
            : 'No balance available'}
      </Card>
      <form className="flexColumn gapLg" onSubmit={formik.handleSubmit}>
        <Input
          endAdornment="USDC"
          errorText={formik.touched.amount && formik.errors.amount ? formik.errors.amount : undefined}
          hint={
            formik.values.amount && formik.values.amount > 0
              ? `You will receive ${formik.values.amount} COMPY`
              : undefined
          }
          label="Amount to convert"
          name="amount"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          type="number"
          value={formik.values.amount}
          disabled={isSwapping}
        />
        <div className="flexRow gapMd justifyContentEnd">
          {onCancel ? (
            <Button
              className="alignSelfEnd"
              color="accent2"
              onClick={onCancel}
              size="lg"
              type="button"
              variant="outlined"
              disabled={isSwapping}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            className="alignSelfEnd"
            color="accent2"
            size="lg"
            type="submit"
            loading={isSwapping}
            disabled={!formik.isValid || !formik.dirty}
          >
            {isSwapping ? 'Converting...' : 'Convert'}
          </Button>
        </div>
      </form>
    </>
  );
};

export default SwapTokens;
