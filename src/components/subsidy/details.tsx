import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import InputWrapper from '@/components/input/input-wrapper';
import { SUBSIDY_STATUS_REFRESH_ERROR } from '@/components/subsidy/subsidy-copy';
import SubsidySummary from '@/components/subsidy/subsidy-summary';
import { useProfileContext } from '@/context/profile-context';
import { useSubsidyContext } from '@/context/subsidy-context';
import { captureError, getHttpStatus } from '@/lib/analytics';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  isValidHandle,
  normalizeHandle,
  normalizeHandles,
  SubmitSubsidyDetailsResponse,
  SUBSIDY_HANDLE_RULES,
  SUBSIDY_HANDLE_SERVICE_CHOICES,
  SubsidyHandles,
  SubsidyHandleService,
} from '@/types/subsidy';
import axios from 'axios';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './details.module.css';

type DetailsFormValues = {
  email: string;
  handles: Record<SubsidyHandleService, string>;
  name: string;
};

const handleSchema = (service: SubsidyHandleService) =>
  Yup.string().test('handle-format', SUBSIDY_HANDLE_RULES[service].message, (value) => {
    return !value || isValidHandle(value, service);
  });

const Details: React.FC = () => {
  const { account, login } = useOceanAccount();
  const router = useRouter();

  const { subsidyDetails, setSubsidyDetails } = useSubsidyContext();
  const { fetchSubsidyStatus } = useProfileContext();

  const formik = useFormik<DetailsFormValues>({
    initialValues: {
      email: subsidyDetails?.email ?? '',
      handles: {
        discord: subsidyDetails?.handles.discord ?? '',
        telegram: subsidyDetails?.handles.telegram ?? '',
        x: subsidyDetails?.handles.x ?? '',
      },
      name: subsidyDetails?.name ?? '',
    },
    onSubmit: async (values) => {
      if (!account.isConnected || !account.address) {
        login();
        return;
      }
      try {
        const handles = normalizeHandles(values.handles);
        const details = {
          email: values.email,
          handles,
          name: values.name,
          walletAddress: account.address,
        };
        const response = await axios.post<SubmitSubsidyDetailsResponse>('/api/subsidy/details', details);
        setSubsidyDetails(details);
        posthog.capture('subsidy_details_submitted', {
          handleServices: Object.keys(handles),
          shouldValidateEmail: response.data.shouldValidateEmail,
        });
        // The step guard reads the saved status.
        if (!(await fetchSubsidyStatus(account.address))) {
          toast.error(SUBSIDY_STATUS_REFRESH_ERROR);
          return;
        }
        if (response.data.shouldValidateEmail) {
          router.push('/subsidy/verify');
        } else {
          router.push('/subsidy/claim');
        }
      } catch (error) {
        const responseMessage: string | undefined = axios.isAxiosError(error)
          ? error.response?.data?.message
          : undefined;
        captureError('subsidy_details_failed', error, { httpStatus: getHttpStatus(error), message: responseMessage });
        toast.error(responseMessage ?? 'Failed to submit form. Please try again.');
        console.error('Failed to submit form', error);
      }
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Required'),
      handles: Yup.object({
        discord: handleSchema('discord'),
        telegram: handleSchema('telegram'),
        x: handleSchema('x'),
      }).test('at-least-one', 'Enter at least one handle', (value) => {
        return Object.keys(normalizeHandles(value as SubsidyHandles)).length > 0;
      }),
      name: Yup.string().required('Required'),
    }),
  });

  const handleHandleBlur =
    (service: SubsidyHandleService) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const normalized = normalizeHandle(e.target.value);
      if (normalized !== formik.values.handles[service]) {
        formik.setFieldValue(`handles.${service}`, normalized);
      }
      formik.handleBlur(e);
    };

  const handlesTouched = formik.submitCount > 0 || Object.values(formik.touched.handles ?? {}).some(Boolean);
  const handlesGroupError =
    handlesTouched && typeof formik.errors.handles === 'string' ? formik.errors.handles : undefined;

  return (
    <Card padding="md" radius="lg" shadow="black" variant="glass-shaded">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <SubsidySummary />
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
            hint="We send a 6-digit code to verify it."
            label="Email address"
            name="email"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="email"
            value={formik.values.email}
          />
          <InputWrapper errorText={handlesGroupError} hint="Enter at least one." label="Socials">
            <div className={styles.handles}>
              {SUBSIDY_HANDLE_SERVICE_CHOICES.map(({ label, value: service }) => {
                const error = typeof formik.errors.handles === 'object' ? formik.errors.handles[service] : undefined;
                return (
                  <Input
                    errorText={formik.touched.handles?.[service] && error ? error : undefined}
                    key={service}
                    name={`handles.${service}`}
                    onBlur={handleHandleBlur(service)}
                    onChange={formik.handleChange}
                    startAdornment={
                      <div className={styles.handleAdornment}>
                        <span className={styles.handleService}>{label}</span>
                        <span className={styles.handlePrefix}>@</span>
                      </div>
                    }
                    type="text"
                    value={formik.values.handles[service]}
                  />
                );
              })}
            </div>
          </InputWrapper>
          <div className={styles.walletAddress}>
            <strong>Wallet address</strong>
            <div>{account.address}</div>
          </div>
        </div>
        <div className="actionsGroupLgEnd">
          <Button color="accent1" loading={formik.isSubmitting} type="submit" size="lg" variant="filled">
            Continue
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default Details;
