import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { ETH_SEPOLIA_ADDRESS } from '@/constants/tokens';
import { useDepositTokens, UseDepositTokensReturn } from '@/lib/use-deposit-tokens';
import { useFormik } from 'formik';
import * as Yup from 'yup';

type GasFeeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type GasFeeModalFormValues = {
  amount: number | '';
};

const GasFeeModalContent = ({
  depositTokens,
  onClose,
}: Pick<GasFeeModalProps, 'onClose'> & { depositTokens: UseDepositTokensReturn }) => {
  const formik = useFormik<GasFeeModalFormValues>({
    initialValues: {
      amount: '',
    },
    onSubmit: (values) => {
      if (values.amount !== '') {
        depositTokens.handleDeposit({
          tokenAddress: ETH_SEPOLIA_ADDRESS,
          amount: values.amount.toString(),
        });
      }
    },
    validationSchema: Yup.object({
      amount: Yup.number().required('Amount is required').min(0, 'Amount must be greater than 0'),
      // .not(0, 'Amount must be greater than 0'),
    }),
  });

  return (
    <form className="flexColumn gapLg" onSubmit={formik.handleSubmit}>
      <Input
        endAdornment="ETH"
        errorText={formik.touched.amount && formik.errors.amount ? formik.errors.amount : undefined}
        label="Amount"
        name="amount"
        onBlur={formik.handleBlur}
        onChange={formik.handleChange}
        placeholder="Enter amount"
        type="number"
        value={formik.values.amount}
      />
      <div className="flexRow gapSm justifyContentEnd">
        <Button
          className="alignSelfEnd"
          color="accent2"
          disabled={depositTokens.isDepositing}
          onClick={onClose}
          size="md"
          type="button"
          variant="outlined"
        >
          Cancel
        </Button>
        <Button className="alignSelfEnd" color="accent2" loading={depositTokens.isDepositing} size="md" type="submit">
          {depositTokens.isDepositing ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </form>
  );
};

const GasFeeModal = ({ isOpen, onClose }: GasFeeModalProps) => {
  const depositTokens = useDepositTokens({
    onSuccess: onClose,
  });
  return (
    <Modal
      hideCloseButton={depositTokens.isDepositing}
      isOpen={isOpen}
      onClose={onClose}
      title="Send tokens for gas fee"
      width="xs"
    >
      <GasFeeModalContent depositTokens={depositTokens} onClose={onClose} />
    </Modal>
  );
};

export default GasFeeModal;
