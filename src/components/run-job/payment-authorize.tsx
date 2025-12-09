import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { useOceanContext } from '@/context/ocean-context';
import { SelectedToken } from '@/context/run-job-context';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './payment-authorize.module.css';

type AuthorizeFormValues = {
  // amountToAuthorize: number;
  maxLockedAmount: number;
  maxLockCount: number;
  maxLockSeconds: number;
};

type PaymentAuthorizeProps = {
  authorizations: any;
  loadPaymentInfo: () => void;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  selectedToken: SelectedToken;
  totalCost: number;
};

const PaymentAuthorize = ({
  authorizations,
  loadPaymentInfo,
  selectedEnv,
  selectedResources,
  selectedToken,
  totalCost,
}: PaymentAuthorizeProps) => {
  const { authorizeTokens } = useOceanContext();

  const formik = useFormik<AuthorizeFormValues>({
    initialValues: {
      // amountToAuthorize: totalCost - (authorizations?.currentLockedAmount ?? 0),
      maxLockedAmount: totalCost,
      maxLockCount: 10,
      maxLockSeconds: selectedResources.maxJobDurationHours * 60 * 60,
    },
    onSubmit: async (values) => {
      try {
        await authorizeTokens(
          selectedToken.address,
          selectedEnv.consumerAddress,
          values.maxLockedAmount.toString(),
          values.maxLockSeconds.toString(),
          values.maxLockCount.toString()
        );
        loadPaymentInfo();
      } catch (error) {
        console.error('Authorize failed:', error);
      }
    },
    validateOnMount: true,
    validationSchema: Yup.object({}),
  });

  return (
    <form className={styles.root} onSubmit={formik.handleSubmit}>
      <div className={styles.inputs}>
        {/* <Input
          endAdornment={selectedToken.symbol}
          errorText={
            formik.touched.amountToAuthorize && formik.errors.amountToAuthorize
              ? formik.errors.amountToAuthorize
              : undefined
          }
          label="Amount to authorize"
          name="amountToAuthorize"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          type="number"
          value={formik.values.amountToAuthorize}
        /> */}
        <Input
          endAdornment={selectedToken.symbol}
          errorText={
            formik.touched.maxLockedAmount && formik.errors.maxLockedAmount ? formik.errors.maxLockedAmount : undefined
          }
          label="Max locked amount"
          name="maxLockedAmount"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          type="number"
          value={formik.values.maxLockedAmount}
        />
        <Input
          endAdornment="seconds"
          errorText={
            formik.touched.maxLockSeconds && formik.errors.maxLockSeconds ? formik.errors.maxLockSeconds : undefined
          }
          label="Max lock seconds"
          name="maxLockSeconds"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          type="number"
          value={formik.values.maxLockSeconds}
        />
        <Input
          endAdornment="locks"
          errorText={formik.touched.maxLockCount && formik.errors.maxLockCount ? formik.errors.maxLockCount : undefined}
          label="Max lock count"
          name="maxLockCount"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          type="number"
          value={formik.values.maxLockCount}
        />
      </div>
      <Button autoLoading className="alignSelfEnd" color="accent2" size="lg" type="submit">
        Authorize
      </Button>
    </form>
  );
};

export default PaymentAuthorize;
