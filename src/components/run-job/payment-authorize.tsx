import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { SelectedToken } from '@/context/run-job-context';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { ComputeEnvironment, EnvResourcesSelection } from '@/types/environments';
import { useFormik } from 'formik';
import { useMemo } from 'react';
import * as Yup from 'yup';
import styles from './payment-authorize.module.css';

type AuthorizeFormValues = {
  // amountToAuthorize: number;
  maxLockedAmount: number;
  maxLockCount: number;
  maxLockSeconds: number;
};

type PaymentAuthorizeProps = {
  currentLockedAmount: number;
  loadingAuthorizations: boolean;
  loadPaymentInfo: () => void;
  selectedEnv: ComputeEnvironment;
  selectedResources: EnvResourcesSelection;
  selectedToken: SelectedToken;
  totalCost: number;
  peerId: string;
};

const PaymentAuthorize = ({
  currentLockedAmount,
  loadingAuthorizations,
  loadPaymentInfo,
  selectedEnv,
  selectedResources,
  selectedToken,
  totalCost,
  peerId,
}: PaymentAuthorizeProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess: loadPaymentInfo });

  const maxJobDurationSec = selectedResources.maxJobDurationHours * 60 * 60;

  const { ocean } = useOceanAccount();

  const resources = useMemo(
    () => [
      { id: selectedResources.cpuId, amount: selectedResources.cpuCores },
      { id: selectedResources.diskId, amount: selectedResources.diskSpace },
      { id: selectedResources.ramId, amount: selectedResources.ram },
      ...selectedResources.gpus.map((gpu) => ({ id: gpu.id, amount: 1 })),
    ],
    [selectedResources]
  );

  const formik = useFormik<AuthorizeFormValues>({
    enableReinitialize: true,
    initialValues: {
      // amountToAuthorize: totalCost - (authorizations?.currentLockedAmount ?? 0),
      maxLockedAmount: totalCost + currentLockedAmount,
      maxLockCount: 10,
      maxLockSeconds: maxJobDurationSec < 1 ? 1 : Math.ceil(maxJobDurationSec),
    },
    onSubmit: async (values) => {
      const { minLockSeconds } = await ocean!.initializeCompute(
        selectedEnv,
        selectedToken.address,
        values.maxLockSeconds,
        peerId,
        selectedEnv.consumerAddress,
        resources
      );
      handleAuthorize({
        tokenAddress: selectedToken.address,
        spender: selectedEnv.consumerAddress,
        maxLockedAmount: values.maxLockedAmount.toString(),
        maxLockSeconds:
          minLockSeconds > values.maxLockSeconds ? minLockSeconds.toString() : values.maxLockSeconds.toString(),
        maxLockCount: values.maxLockCount.toString(),
      });
    },
    validateOnMount: true,
    validationSchema: Yup.object({
      maxLockSeconds: Yup.number().required('Required').integer('Integer required').min(1, 'Minimum 1'),
      maxLockCount: Yup.number().required('Required').integer('Integer required').min(1, 'Minimum 1'),
      maxLockedAmount: Yup.number().required('Required'),
    }),
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
      <Button
        className="alignSelfEnd"
        color="accent2"
        loading={loadingAuthorizations || isAuthorizing}
        size="lg"
        type="submit"
      >
        Authorize
      </Button>
    </form>
  );
};

export default PaymentAuthorize;
