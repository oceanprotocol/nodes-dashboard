import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TwoFactorInput from '@/components/input/two-factor-input';
import useCooldown from '@/hooks/use-cooldown';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import styles from './verify.module.css';

type VerifyFormValues = {
  code: string;
};

const Verify: React.FC = () => {
  const router = useRouter();

  const resendCooldown = useCooldown(5);

  const formik = useFormik<VerifyFormValues>({
    initialValues: {
      code: '',
    },
    onSubmit: () => {
      router.push('/grant/claim');
    },
  });

  const handleResend = () => {
    resendCooldown.initiateCooldown();
    console.log('Resend');
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
