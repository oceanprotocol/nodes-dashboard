import Input from '@/components/input/input';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './authorization-form.module.css';

export type AuthorizationFormValues = {
  maxLockedAmount: number;
  maxLockSeconds: number;
  maxLockCount: number;
};

type AuthorizationFormProps = {
  initialValues: AuthorizationFormValues;
  loading?: boolean;
  minLockCount?: number;
  minLockSeconds?: number;
  onSubmit: (values: AuthorizationFormValues) => void;
  renderSecondaryAction?: (disabled: boolean) => React.ReactNode;
  renderSubmitButton: (state: { disabled: boolean; loading: boolean }) => React.ReactNode;
  tokenSymbol: string;
};

const AuthorizationForm = ({
  initialValues,
  loading,
  minLockCount = 1,
  minLockSeconds = 1,
  onSubmit,
  renderSecondaryAction,
  renderSubmitButton,
  tokenSymbol,
}: AuthorizationFormProps) => {
  const formik = useFormik<AuthorizationFormValues>({
    enableReinitialize: true,
    initialValues,
    onSubmit,
    validateOnMount: true,
    validationSchema: Yup.object({
      maxLockedAmount: Yup.number().required('Required').min(0, 'Invalid amount'),
      maxLockSeconds: Yup.number()
        .required('Required')
        .integer('Integer required')
        .min(minLockSeconds, `Minimum ${minLockSeconds}`),
      maxLockCount: Yup.number()
        .required('Required')
        .integer('Integer required')
        .min(minLockCount, `Minimum ${minLockCount}`),
    }),
  });

  return (
    <form className={styles.root} onSubmit={formik.handleSubmit}>
      <div className={styles.inputs}>
        <Input
          endAdornment={tokenSymbol}
          errorText={
            formik.touched.maxLockedAmount && formik.errors.maxLockedAmount ? formik.errors.maxLockedAmount : undefined
          }
          label="Max locked amount"
          name="maxLockedAmount"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          step="any"
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
      <div className="actionsGroupLgBetween">
        {renderSecondaryAction?.(!!loading)}
        {renderSubmitButton({ disabled: !formik.isValid, loading: !!loading })}
      </div>
    </form>
  );
};

export default AuthorizationForm;
