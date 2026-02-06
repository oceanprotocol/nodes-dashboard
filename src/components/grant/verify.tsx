import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TwoFactorInput from '@/components/input/two-factor-input';
import useCooldown from '@/hooks/use-cooldown';
import { GrantDetails } from '@/types/grant';
import axios from 'axios';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import styles from './verify.module.css';

type VerifyProps = {
  grantDetails: GrantDetails;
};

type VerifyFormValues = {
  code: string;
};

const Verify: React.FC<VerifyProps> = ({ grantDetails }) => {
  const router = useRouter();

  const resendCooldown = useCooldown(5);

  const formik = useFormik<VerifyFormValues>({
    initialValues: {
      code: '',
    },
    onSubmit: async (values) => {
      try {
        await axios.post('/api/grant/verify', {
          code: values.code,
          email: grantDetails?.email,
        });
        router.push('/grant/claim');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error('Failed to verify code. Please try again.');
        }
      }
    },
  });

  const handleResend = async () => {
    resendCooldown.initiateCooldown();
    try {
      await axios.post('/api/grant/submit', {
        email: grantDetails?.email,
        resend: true,
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to resend code. Please try again.');
      }
    }
  };

  useEffect(() => {
    resendCooldown.initiateCooldown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className={styles.root} padding="md" radius="lg" variant="glass-shaded">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <div className={styles.group}>
          <h3>Verify your email</h3>
          <div>Enter the 6-digit verification code sent to your email</div>
        </div>
        <TwoFactorInput onChange={(code) => formik.setFieldValue('code', code)} value={formik.values.code} />
        <div className={styles.group}>
          <div>
            Didn&apos;t receive the code?&nbsp;
            <button
              className={styles.linkButton}
              disabled={resendCooldown.isCoolingDown}
              onClick={handleResend}
              type="button"
            >
              {resendCooldown.isCoolingDown ? `Resend in ${resendCooldown.remainingCooldown}s` : 'Resend'}
            </button>
          </div>
          <Button
            className="alignSelfStretch"
            disabled={formik.values.code.length !== 6}
            color="accent2"
            loading={formik.isSubmitting}
            size="lg"
            type="submit"
            variant="filled"
          >
            Verify code
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default Verify;
