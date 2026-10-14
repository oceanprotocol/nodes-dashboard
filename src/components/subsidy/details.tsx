import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import SubsidyOffer from '@/components/subsidy/subsidy-offer';
import { useProfileContext } from '@/context/profile-context';
import { useSubsidyContext } from '@/context/subsidy-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  isValidHandle,
  normalizeHandle,
  SubmitSubsidyDetailsResponse,
  SUBSIDY_HANDLE_RULES,
  SUBSIDY_HANDLE_SERVICE_CHOICES,
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
  handle: string;
  handleService: SubsidyHandleService;
  name: string;
};

const Details: React.FC = () => {
  const { account, login } = useOceanAccount();
  const router = useRouter();

  const { subsidyDetails, setSubsidyDetails } = useSubsidyContext();
  const { fetchSubsidyStatus } = useProfileContext();

  const formik = useFormik<DetailsFormValues>({
    initialValues: {
      email: subsidyDetails?.email ?? '',
      handle: subsidyDetails?.handle ?? '',
      handleService: subsidyDetails?.handleService ?? SUBSIDY_HANDLE_SERVICE_CHOICES[0].value,
      name: subsidyDetails?.name ?? '',
    },
    onSubmit: async (values) => {
      if (!account.isConnected || !account.address) {
        login();
        return;
      }
      try {
        const details = {
          email: values.email,
          handle: normalizeHandle(values.handle),
          handleService: values.handleService,
          name: values.name,
          walletAddress: account.address,
        };
        const response = await axios.post<SubmitSubsidyDetailsResponse>('/api/subsidy/details', details);
        setSubsidyDetails(details);
        posthog.capture('grant_form_completed', { handleService: values.handleService });
        // The step guard reads the saved status.
        await fetchSubsidyStatus(account.address);
        if (response.data.shouldValidateEmail) {
          router.push({ pathname: '/subsidy/verify', query: response.data.emailChanged ? { emailChanged: 1 } : {} });
        } else {
          router.push('/subsidy/claim');
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
      handle: Yup.string()
        .required('Required')
        .test('handle-format', function (value) {
          const service = (this.parent as DetailsFormValues).handleService;
          if (!value || isValidHandle(value, service)) {
            return true;
          }
          return this.createError({ message: SUBSIDY_HANDLE_RULES[service].message });
        }),
      handleService: Yup.string()
        .oneOf(SUBSIDY_HANDLE_SERVICE_CHOICES.map((c) => c.value))
        .required('Required'),
      name: Yup.string().required('Required'),
    }),
  });

  const handleHandleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const normalized = normalizeHandle(e.target.value);
    if (normalized !== formik.values.handle) {
      formik.setFieldValue('handle', normalized);
    }
    formik.handleBlur(e);
  };

  return (
    <Card padding="md" radius="lg" shadow="black" variant="glass-shaded">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <SubsidyOffer />
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
                  {SUBSIDY_HANDLE_SERVICE_CHOICES.map((choice) => (
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
