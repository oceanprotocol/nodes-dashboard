import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Modal from '@/components/modal/modal';
import { useTransferTokens, UseTransferTokensReturn } from '@/lib/use-transfer-tokens';
import { NodeBalance } from '@/types/nodes';
import { ethers } from 'ethers';
import { useFormik } from 'formik';
import * as Yup from 'yup';

interface TransferModalProps {
  balances: NodeBalance[];
  isOpen: boolean;
  onClose: () => void;
}

type TransferModalFormValues = {
  token: string;
  toAddress: string;
  amount: string;
};

const TransferModalContent = ({
  balances,
  onClose,
  transferTokens,
}: TransferModalProps & { transferTokens: UseTransferTokensReturn }) => {
  const formik = useFormik<TransferModalFormValues>({
    initialValues: {
      token: '',
      toAddress: '',
      amount: '',
    },
    onSubmit: (values) => {
      const tokenBalance = balances.find((b) => b.token === values.token);
      if (!tokenBalance) return;

      transferTokens.handleTransfer({
        tokenAddress: tokenBalance.address,
        toAddress: values.toAddress,
        amount: values.amount,
      });
    },
    validationSchema: Yup.object({
      token: Yup.string().required('Select a token'),
      toAddress: Yup.string()
        .required('Recipient address is required')
        .test('is-valid-address', 'Invalid Ethereum address', (value) => {
          if (!value) return false;
          return ethers.isAddress(value);
        }),
      amount: Yup.number()
        .required('Amount is required')
        .positive('Amount must be greater than 0')
        .typeError('Amount must be a number'),
    }),
  });

  const selectedBalance = balances.find((b) => b.token === formik.values.token);

  const setMaxAmount = () => {
    if (selectedBalance) {
      formik.setFieldValue('amount', String(selectedBalance.amount));
    }
  };

  return (
    <form className="flexColumn gapLg" onSubmit={formik.handleSubmit}>
      <Select
        errorText={formik.touched.token && formik.errors.token ? formik.errors.token : undefined}
        label="Token"
        name="token"
        onBlur={formik.handleBlur}
        onChange={(e: any) => formik.setFieldValue('token', e.target.value)}
        options={balances.map((balance) => ({
          label: `${balance.token} (${balance.amount})`,
          value: balance.token,
        }))}
        value={formik.values.token}
      />
      <Input
        errorText={formik.touched.toAddress && formik.errors.toAddress ? formik.errors.toAddress : undefined}
        label="Recipient address"
        name="toAddress"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        placeholder="0x..."
        type="text"
        value={formik.values.toAddress}
      />
      <Input
        errorText={formik.touched.amount && formik.errors.amount ? formik.errors.amount : undefined}
        endAdornment={
          <Button color="accent2" size="sm" onClick={setMaxAmount} type="button" variant="filled">
            Set max
          </Button>
        }
        label="Amount"
        name="amount"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        topRight={selectedBalance ? `Balance: ${selectedBalance.amount}` : undefined}
        type="number"
        value={formik.values.amount}
      />
      <div className="flexRow gapSm justifyContentEnd">
        <Button
          className="alignSelfEnd"
          color="accent1"
          disabled={transferTokens.isTransferring}
          onClick={onClose}
          size="md"
          type="button"
          variant="outlined"
        >
          Cancel
        </Button>
        <Button color="accent1" loading={transferTokens.isTransferring} size="md" type="submit">
          {transferTokens.isTransferring ? 'Transferring...' : 'Transfer'}
        </Button>
      </div>
    </form>
  );
};

const TransferModal = ({ balances, isOpen, onClose }: TransferModalProps) => {
  const transferTokens = useTransferTokens({
    onSuccess: onClose,
  });

  return (
    <Modal
      hideCloseButton={transferTokens.isTransferring}
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer tokens"
      width="xs"
    >
      <TransferModalContent balances={balances} isOpen={isOpen} onClose={onClose} transferTokens={transferTokens} />
    </Modal>
  );
};

export default TransferModal;
