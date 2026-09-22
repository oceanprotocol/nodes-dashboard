import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import { useGrantContext } from '@/context/grant-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  GRANT_GOAL_CHOICES,
  GRANT_HANDLE_RULES,
  GRANT_HANDLE_SERVICE_CHOICES,
  GRANT_HARDWARE_CHOICES,
  GRANT_OS_CHOICES,
  GRANT_ROLE_CHOICES,
  GrantHandleService,
  isValidHandle,
  normalizeHandle,
  SubmitGrantDetailsResponse,
} from '@/types/grant';
import axios from 'axios';
import classNames from 'classnames';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './details.module.css';
import VerifyModal from './verify-modal';

type DetailsFormValues = {
  email: string;
  goal: string | null;
  handle: string;
  handleService: GrantHandleService;
  hardware: string[];
  name: string;
  os: string | null;
  role: string | null;
};

const Details: React.FC = () => {
  const { account, login } = useOceanAccount();
  const router = useRouter();

  const { clearGrantSelection, grantDetails, setGrantDetails } = useGrantContext();

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);

  useEffect(() => {
    clearGrantSelection();
  }, [clearGrantSelection]);

  const formik = useFormik<DetailsFormValues>({
    initialValues: {
      email: '',
      goal: null,
      handle: '',
      handleService: GRANT_HANDLE_SERVICE_CHOICES[0].value,
      hardware: [],
      name: '',
      os: null,
      role: null,
    },
    onSubmit: async (values) => {
      if (!account.isConnected || !account.address) {
        login();
        return;
      }
      try {
        const details = {
          email: values.email,
          goal: values.goal!,
          handle: normalizeHandle(values.handle),
          handleService: values.handleService,
          hardware: values.hardware,
          name: values.name,
          os: values.os!,
          role: values.role!,
          walletAddress: account.address,
        };
        const response = await axios.post<SubmitGrantDetailsResponse>('/api/grant/details', details);
        setGrantDetails(details);
        posthog.capture('grant_form_completed', {
          handleService: values.handleService,
          role: values.role,
          goal: values.goal,
          hardware: values.hardware,
          os: values.os,
        });
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
      handle: Yup.string()
        .required('Required')
        .test('handle-format', function (value) {
          const service = (this.parent as DetailsFormValues).handleService;
          if (!value || isValidHandle(value, service)) {
            return true;
          }
          return this.createError({ message: GRANT_HANDLE_RULES[service].message });
        }),
      handleService: Yup.string()
        .oneOf(GRANT_HANDLE_SERVICE_CHOICES.map((c) => c.value))
        .required('Required'),
      hardware: Yup.array().min(1, 'Selection required'),
      name: Yup.string().required('Required'),
      os: Yup.string().required('Selection required'),
      role: Yup.string().required('Selection required'),
    }),
  });

  // Collapse pasted profile links, stray "@" and whitespace as soon as the field loses focus,
  // so what the user sees matches what gets stored and deduped.
  const handleHandleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const normalized = normalizeHandle(e.target.value);
    if (normalized !== formik.values.handle) {
      formik.setFieldValue('handle', normalized);
    }
    formik.handleBlur(e);
  };

  const handleVerifySuccess = () => {
    setIsVerifyModalOpen(false);
    router.push('/grant/claim');
  };

  return (
    <Card padding="md" radius="lg" shadow="black" variant="glass-shaded">
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
          <Input
            errorText={formik.touched.handle && formik.errors.handle ? formik.errors.handle : undefined}
            label="Handle"
            name="handle"
            onBlur={handleHandleBlur}
            onChange={formik.handleChange}
            startAdornment={
              <div className={styles.handleAdornment}>
                <select
                  aria-label="Handle service"
                  className={styles.handleServiceSelect}
                  name="handleService"
                  onChange={formik.handleChange}
                  value={formik.values.handleService}
                >
                  {GRANT_HANDLE_SERVICE_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
                <span className={styles.handlePrefix}>@</span>
              </div>
            }
            type="text"
            value={formik.values.handle}
          />
          <div className={styles.walletAddress}>
            <strong>Wallet address</strong>
            <div>{account.address}</div>
          </div>
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
        <div className="actionsGroupLgEnd">
          <Button color="accent1" loading={formik.isSubmitting} type="submit" size="lg" variant="filled">
            Continue
          </Button>
        </div>
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
