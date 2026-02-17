import Button from '@/components/button/button';
import TwoFactorInput from '@/components/input/two-factor-input';
import Modal from '@/components/modal/modal';
import useCountdown from '@/hooks/use-countdown';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GrantDetails } from '@/types/grant';
import axios from 'axios';
import { useFormik } from 'formik';
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import styles from './verify-modal.module.css';

type VerifyModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  grantDetails: GrantDetails;
};

type VerifyFormValues = {
  code: string;
};

const VerifyModal: React.FC<VerifyModalProps> = ({ isOpen, onClose, onSuccess, grantDetails }) => {
  const { account } = useOceanAccount();

  const expiryCountdown = useCountdown(10 * 60); // 10 minutes
  const resendCountdown = useCountdown(5);

  const formik = useFormik<VerifyFormValues>({
    initialValues: {
      code: '',
    },
    onSubmit: async (values) => {
      try {
        await axios.post('/api/grant/verify', {
          code: values.code,
          walletAddress: account.address,
        });
        onSuccess();
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
    resendCountdown.initiateCountdown();
    try {
      await axios.post('/api/grant/resend-otp', {
        walletAddress: account.address,
      });
      toast.success(`A new code was sent to ${grantDetails.email}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to resend code. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      expiryCountdown.initiateCountdown();
      resendCountdown.initiateCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify your email" width="xs">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <div className={styles.group}>
          <div>Enter the 6-digit verification code sent to your email</div>
          <div>
            Code expires in&nbsp;
            {`${Math.floor(expiryCountdown.remainingCountdown / 60)}:${expiryCountdown.remainingCountdown % 60}`}
          </div>
        </div>
        <TwoFactorInput onChange={(code) => formik.setFieldValue('code', code)} value={formik.values.code} />
        <div className={styles.group}>
          <div>
            Didn&apos;t receive the code?&nbsp;
            <button
              className={styles.linkButton}
              disabled={resendCountdown.isCountingDown}
              onClick={handleResend}
              type="button"
            >
              {resendCountdown.isCountingDown ? `Resend in ${resendCountdown.remainingCountdown}s` : 'Resend'}
            </button>
          </div>
          <Button
            className="alignSelfStretch"
            disabled={formik.values.code.length !== 6 || formik.isSubmitting}
            color="accent1"
            loading={formik.isSubmitting}
            size="lg"
            type="submit"
            variant="filled"
          >
            Verify code
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VerifyModal;
