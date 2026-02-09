import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import { useGrantContext } from '@/context/grant-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  GRANT_GOAL_CHOICES,
  GRANT_HARDWARE_CHOICES,
  GRANT_OS_CHOICES,
  GRANT_ROLE_CHOICES,
  SubmitGrantDetailsResponse,
} from '@/types/grant';
import { useAuthModal } from '@account-kit/react';
import axios from 'axios';
import classNames from 'classnames';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './details.module.css';
import VerifyModal from './verify-modal';

type DetailsFormValues = {
  email: string;
  goal: string | null;
  handle: string;
  hardware: string[];
  name: string;
  os: string | null;
  role: string | null;
};

const Details: React.FC = () => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();
  const { account } = useOceanAccount();
  const router = useRouter();

  const { clearGrantSelection, grantDetails, setGrantDetails } = useGrantContext();

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  useEffect(() => {
    clearGrantSelection();
  }, [clearGrantSelection]);

  const formik = useFormik<DetailsFormValues>({
    initialValues: {
      email: '',
      goal: null,
      handle: '',
      hardware: [],
      name: '',
      os: null,
      role: null,
    },
    onSubmit: async (values) => {
      if (!account.isConnected || !account.address) {
        openAuthModal();
        return;
      }
      try {
        const response = await axios.post<SubmitGrantDetailsResponse>('/api/grant/details', values);
        const details = {
          email: values.email,
          goal: values.goal!,
          handle: values.handle,
          hardware: values.hardware,
          name: values.name,
          os: values.os!,
          role: values.role!,
          walletAddress: account.address,
        };
        setGrantDetails(details);
        if (response.data.shouldValidateEmail) {
          setIsVerifyModalOpen(true);
        } else {
          router.push('/grant/claim');
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error('Failed to submit form. Please try again.');
        }
        console.error('Failed to submit form', error);
      }
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Required'),
      goal: Yup.string().required('Selection required'),
      handle: Yup.string().required('Required'),
      hardware: Yup.array().min(1, 'Selection required'),
      name: Yup.string().required('Required'),
      os: Yup.string().required('Selection required'),
      role: Yup.string().required('Selection required'),
    }),
  });

  const handleVerifySuccess = () => {
    setIsVerifyModalOpen(false);
    router.push('/grant/claim');
  };

  return (
    <Card padding="md" radius="lg" variant="glass-shaded">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <div className={styles.section}>
          <h3>User details</h3>
          <Input
            errorText={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            label="Name"
            name="name"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.name}
          />
          <Input
            errorText={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
            label="Email address"
            name="email"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="email"
            value={formik.values.email}
          />
          <Input disabled label="ERC-20 Wallet Address " type="text" value={account.address} />
          <Input
            errorText={formik.touched.handle && formik.errors.handle ? formik.errors.handle : undefined}
            label="Discord or Telegram handle"
            name="handle"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.handle}
          />
        </div>
        <div className={styles.section}>
          <div>
            <h3>Which role best describes you?</h3>
            {formik.touched.role && formik.errors.role ? <div className="textError">{formik.errors.role}</div> : null}
          </div>
          <div className={classNames(styles.choices, styles.choices3cols)}>
            {GRANT_ROLE_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.role === choice.value}
                key={choice.value}
                label={choice.label}
                name="role"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What hardware do you currently have access to?</h3>
            {formik.touched.hardware && formik.errors.hardware ? (
              <div className="textError">{formik.errors.hardware}</div>
            ) : null}
          </div>
          <div className={classNames(styles.choices, styles.choices2cols)}>
            {GRANT_HARDWARE_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.hardware.includes(choice.value)}
                key={choice.value}
                label={choice.label}
                name="hardware"
                onChange={formik.handleChange}
                type="multiple"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What is your preferred Operating System?</h3>
            {formik.touched.os && formik.errors.os ? <div className="textError">{formik.errors.os}</div> : null}
          </div>
          <div className={classNames(styles.choices, styles.choicesRow)}>
            {GRANT_OS_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.os === choice.value}
                key={choice.value}
                label={choice.label}
                name="os"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What is your primary goal for this grant?</h3>
            {formik.touched.goal && formik.errors.goal ? <div className="textError">{formik.errors.goal}</div> : null}
          </div>
          <div className={styles.choices}>
            {GRANT_GOAL_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.goal === choice.value}
                key={choice.value}
                label={
                  <div>
                    <strong>{choice.label}:</strong>&nbsp;
                    {choice.description}
                  </div>
                }
                name="goal"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <Button
          className="alignSelfEnd"
          color="accent2"
          loading={formik.isSubmitting}
          type="submit"
          size="lg"
          variant="filled"
        >
          Continue
        </Button>
      </form>
      {grantDetails ? (
        <VerifyModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          onSuccess={handleVerifySuccess}
          grantDetails={grantDetails}
        />
      ) : null}
    </Card>
  );
};

export default Details;
