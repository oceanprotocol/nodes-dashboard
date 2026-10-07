import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Modal from '@/components/modal/modal';
import { NATIVE_TOKEN_ADDRESS } from '@/constants/tokens';
import { NodeUri, useP2P } from '@/contexts/P2PContext';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { NodeBalance } from '@/types/nodes';
import { ethers } from 'ethers';
import { useFormik } from 'formik';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';

type WithdrawModalProps = {
  balances: NodeBalance[];
  isOpen: boolean;
  nodeUri: NodeUri;
  onClose: () => void;
  onSuccess?: () => void;
};

type WithdrawModalFormValues = {
  amount: string;
  toAddress: string;
  token: string;
};

const WithdrawModalContent = ({
  balances,
  isWithdrawing,
  onClose,
  onSubmit,
}: Pick<WithdrawModalProps, 'balances' | 'onClose'> & {
  isWithdrawing: boolean;
  onSubmit: (values: WithdrawModalFormValues) => Promise<void>;
}) => {
  const { account } = useOceanAccount();

  const formik = useFormik<WithdrawModalFormValues>({
    initialValues: {
      amount: '',
      toAddress: account?.address ?? '',
      token: balances.find((balance) => balance.token === 'USDC')?.token ?? balances[0]?.token ?? '',
    },
    onSubmit,
    validationSchema: Yup.object({
      amount: Yup.number()
        .required('Amount is required')
        .positive('Amount must be greater than 0')
        .typeError('Amount must be a number')
        .test('max-balance', 'Insufficient node balance', (value, context) => {
          const selected = balances.find((balance) => balance.token === context.parent.token);
          return !selected || value === undefined || value <= selected.amount;
        }),
      toAddress: Yup.string()
        .required('Recipient address is required')
        .test('is-valid-address', 'Invalid Ethereum address', (value) => {
          if (!value) {
            return false;
          }
          return ethers.isAddress(value);
        }),
      token: Yup.string().required('Select a token'),
    }),
  });

  const selectedBalance = balances.find((balance) => balance.token === formik.values.token);

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
      <div className="actionsGroupMdEnd">
        <Button color="accent1" disabled={isWithdrawing} onClick={onClose} size="md" type="button" variant="outlined">
          Cancel
        </Button>
        <Button color="accent1" loading={isWithdrawing} size="md" type="submit">
          {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
        </Button>
      </div>
    </form>
  );
};

const WithdrawModal = ({ balances, isOpen, nodeUri, onClose, onSuccess }: WithdrawModalProps) => {
  const { account, signMessage } = useOceanAccount();
  const { collectNodeFees } = useP2P();

  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  const handleWithdraw = async ({ amount, toAddress, token }: WithdrawModalFormValues) => {
    const selectedBalance = balances.find((balance) => balance.token === token);
    if (!selectedBalance) {
      return;
    }
    setIsWithdrawing(true);
    try {
      await collectNodeFees({
        amount: String(amount),
        consumerAddress: account?.address,
        destinationAddress: toAddress,
        nodeUri,
        signMessage,
        tokenAddress: selectedBalance.address || NATIVE_TOKEN_ADDRESS,
      });
      toast.success('Withdraw successful!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error(error instanceof Error ? error.message : 'Withdraw failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <Modal hideCloseButton={isWithdrawing} isOpen={isOpen} onClose={onClose} title="Withdraw funds" width="sm">
      <WithdrawModalContent
        balances={balances}
        isWithdrawing={isWithdrawing}
        onClose={onClose}
        onSubmit={handleWithdraw}
      />
    </Modal>
  );
};

export default WithdrawModal;
