import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Modal from '@/components/modal/modal';
import { useWithdrawTokens, UseWithdrawTokensReturn } from '@/lib/use-withdraw-tokens';
import { NodeBalance } from '@/types/nodes';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './balance.module.css';

interface WithdrawModalProps {
  balances: NodeBalance[];
  isOpen: boolean;
  onClose: () => void;
}

type WithdrawModalFormValues = {
  amounts: Record<string, string>;
  tokens: string[];
};

const WithdrawModalContent = ({
  balances,
  onClose,
  withdrawTokens,
}: WithdrawModalProps & { withdrawTokens: UseWithdrawTokensReturn }) => {
  const formik = useFormik<WithdrawModalFormValues>({
    initialValues: {
      amounts: {},
      tokens: [],
    },
    onSubmit: (values) => {
      const tokenAddresses = values.tokens
        .map((token) => balances.find((b) => b.token === token)?.address)
        .filter((addr): addr is string => !!addr);
      const amounts = values.tokens.map((token) => values.amounts[token] ?? '0');
      if (tokenAddresses.length > 0 && amounts.every((amt) => parseFloat(amt) > 0)) {
        withdrawTokens.handleWithdraw({
          tokenAddresses,
          amounts,
        });
      }
    },
    validationSchema: Yup.object({
      tokens: Yup.array().min(1, 'Select at least one token'),
      amounts: Yup.object().test(
        'amounts-validation',
        'Invalid amounts',
        (amounts: Record<string, string>, context) => {
          const tokens = (context.parent.tokens as string[]) || [];
          if (tokens.length === 0) {
            return true;
          }
          const errors: Yup.ValidationError[] = [];
          for (const token of tokens) {
            const amount = amounts?.[token];
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
              errors.push(
                context.createError({
                  path: `amounts.${token}`,
                  message: `${token} amount required`,
                })
              );
            }
          }
          if (errors.length > 0) {
            return new Yup.ValidationError(errors, amounts, 'amounts');
          }
          return true;
        }
      ),
    }),
  });

  const setMaxAmount = (token: string) => {
    const balance = balances.find((b) => b.token === token)?.amount;
    if (balance) {
      formik.setFieldValue(`amounts.${token}`, balance);
    }
  };

  /**
   * Handles token selection change
   * When a token is removed from the selection, the corresponding amount is also removed
   */
  const handleTokensChange = (newTokens: string[]) => {
    formik.setFieldValue('tokens', newTokens);
    const newAmounts = { ...formik.values.amounts };
    // Remove amounts for deselected tokens
    Object.keys(newAmounts).forEach((token) => {
      if (!newTokens.includes(token)) {
        newAmounts[token] = '';
      }
    });
    // Initialize amounts for newly selected tokens
    newTokens.forEach((token) => {
      if (!(token in newAmounts)) {
        newAmounts[token] = '';
      }
    });
    formik.setFieldValue('amounts', newAmounts);
  };

  return (
    <form className="flexColumn gapLg" onSubmit={formik.handleSubmit}>
      <Select
        errorText={formik.touched.tokens && formik.errors.tokens ? formik.errors.tokens : undefined}
        label="Tokens to withdraw"
        multiple
        name="tokens"
        onBlur={formik.handleBlur}
        onChange={(e) => handleTokensChange(e.target.value)}
        options={balances.map((balance) => ({
          label: balance.token,
          value: balance.token,
        }))}
        value={formik.values.tokens}
      />
      {formik.values.tokens.map((token) => {
        const maxAmount = balances.find((b) => b.token === token)?.amount;
        return (
          <Input
            errorText={
              formik.touched.amounts?.[token] && formik.errors.amounts?.[token]
                ? formik.errors.amounts?.[token]
                : undefined
            }
            endAdornment={
              <Button color="accent1" size="sm" onClick={() => setMaxAmount(token)} type="button" variant="outlined">
                Set max
              </Button>
            }
            key={token}
            label={`${token} amount`}
            name={`amounts.${token}`}
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            topRight={`Max ${maxAmount}`}
            type="number"
            value={formik.values.amounts[token] ?? ''}
          />
        );
      })}
      <div className="flexRow gapSm justifyContentEnd">
        <Button
          className="alignSelfEnd"
          color="accent2"
          disabled={withdrawTokens.isWithdrawing}
          onClick={onClose}
          size="md"
          type="button"
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          className={styles.modalButton}
          color="accent2"
          loading={withdrawTokens.isWithdrawing}
          size="md"
          type="submit"
        >
          {withdrawTokens.isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
        </Button>
      </div>
    </form>
  );
};

const WithdrawModal = ({ balances, isOpen, onClose }: WithdrawModalProps) => {
  const withdrawTokens = useWithdrawTokens({
    onSuccess: onClose,
  });
  return (
    <Modal
      hideCloseButton={withdrawTokens.isWithdrawing}
      isOpen={isOpen}
      onClose={onClose}
      title="Withdraw funds"
      width="xs"
    >
      <WithdrawModalContent balances={balances} isOpen={isOpen} onClose={onClose} withdrawTokens={withdrawTokens} />
    </Modal>
  );
};

export default WithdrawModal;
