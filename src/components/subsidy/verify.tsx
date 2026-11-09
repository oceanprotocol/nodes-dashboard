import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TwoFactorInput, { CODE_LENGTH } from '@/components/input/two-factor-input';
import { SUBSIDY_STATUS_REFRESH_ERROR } from '@/components/subsidy/subsidy-copy';
import { useProfileContext } from '@/context/profile-context';
import { useSubsidyContext } from '@/context/subsidy-context';
import useCountdown from '@/hooks/use-countdown';
import { captureError, getHttpStatus } from '@/lib/analytics';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS, SubsidyVerifyError, SubsidyVerifyErrorResponse } from '@/types/subsidy';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import axios from 'axios';
import classNames from 'classnames';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './verify.module.css';

type VerifyState = { attemptsLeft?: number; error?: SubsidyVerifyError };

const secondsUntil = (timestamp: number | undefined) =>
  timestamp ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : 0;

const formatMinutesSeconds = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

const Verify: React.FC = () => {
  const { account } = useOceanAccount();
  const { subsidyDetails } = useSubsidyContext();
  const { fetchSubsidyStatus, subsidyInfo } = useProfileContext();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [state, setState] = useState<VerifyState>({});
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const expiryCountdown = useCountdown(0);
  const resendCountdown = useCountdown(SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS);

  const email = subsidyDetails?.email ?? subsidyInfo?.maskedEmail ?? '';

  const { initiateCountdown: initiateExpiry } = expiryCountdown;
  const { initiateCountdown: initiateResend } = resendCountdown;

  useEffect(() => {
    if (subsidyInfo?.otpExpires) {
      setExpiresAt(subsidyInfo.otpExpires);
      initiateExpiry(secondsUntil(subsidyInfo.otpExpires));
    }
    if (subsidyInfo?.otpLastResent) {
      initiateResend(secondsUntil(subsidyInfo.otpLastResent + SUBSIDY_OTP_RESEND_COOLDOWN_SECONDS * 1000));
    }
    if (subsidyInfo?.otpLocked) {
      setState({ error: SubsidyVerifyError.LOCKED });
    }
  }, [subsidyInfo?.otpExpires, subsidyInfo?.otpLastResent, subsidyInfo?.otpLocked, initiateExpiry, initiateResend]);

  const isLocked = state.error === SubsidyVerifyError.LOCKED;
  const isExpired =
    !isLocked &&
    (state.error === SubsidyVerifyError.EXPIRED || (expiresAt !== null && !expiryCountdown.isCountingDown));
  const isInvalid = state.error === SubsidyVerifyError.INVALID_CODE;

  const submitCode = useCallback(
    async (value: string) => {
      setIsSubmitting(true);
      try {
        await axios.post('/api/subsidy/verify', {
          code: value,
          email: subsidyDetails?.email,
          walletAddress: account.address,
        });
        posthog.capture('subsidy_email_verified');
        // The step guard moves on to Claim.
        if (!(await fetchSubsidyStatus(account.address!))) {
          toast.error(SUBSIDY_STATUS_REFRESH_ERROR);
        }
      } catch (error) {
        const body = axios.isAxiosError(error) ? (error.response?.data as SubsidyVerifyErrorResponse) : undefined;
        captureError('subsidy_email_verify_failed', error, {
          attemptsLeft: body?.attemptsLeft,
          httpStatus: getHttpStatus(error),
          verifyError: body?.error,
        });
        if (body?.error) {
          setState({ attemptsLeft: body.attemptsLeft, error: body.error });
        } else {
          toast.error(body?.message ?? 'Failed to verify code. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [account.address, fetchSubsidyStatus, subsidyDetails?.email]
  );

  const handleCodeChange = (value: string) => {
    if (isInvalid) {
      setState({});
    }
    setCode(value);
    if (value.length === CODE_LENGTH && !isSubmitting) {
      submitCode(value);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await axios.post<{ otpExpires?: number; retryAfter?: number; sent: boolean }>(
        '/api/subsidy/resend-otp',
        { walletAddress: account.address }
      );
      posthog.capture('subsidy_otp_resent', { sent: response.data.sent });
      if (response.data.sent) {
        initiateResend();
        if (response.data.otpExpires) {
          setExpiresAt(response.data.otpExpires);
          initiateExpiry(secondsUntil(response.data.otpExpires));
        }
        setCode('');
        setState({});
        toast.success(`A new code was sent to ${email}`);
      } else if (response.data.retryAfter) {
        initiateResend(response.data.retryAfter);
        toast.info(`Please wait ${response.data.retryAfter}s before requesting a new code`);
      }
    } catch (error) {
      captureError('subsidy_otp_resend_failed', error, { httpStatus: getHttpStatus(error) });
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to resend code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const renderStatus = () => {
    if (isLocked) {
      return (
        <>
          <Card className={styles.notice} radius="sm" variant="error-outline">
            <strong>Too many incorrect codes</strong>
            <span className={styles.muted}>For your security this code is blocked. Send a new code to try again.</span>
          </Card>
          <div className={styles.spread}>
            <span className={styles.muted}>
              {resendCountdown.isCountingDown
                ? `New code available in ${formatMinutesSeconds(resendCountdown.remainingCountdown)}`
                : 'You can request a new code now'}
            </span>
            <Button
              color="accent1"
              disabled={resendCountdown.isCountingDown}
              loading={isResending}
              onClick={handleResend}
              size="sm"
            >
              Send a new code
            </Button>
          </div>
        </>
      );
    }
    if (isExpired) {
      return (
        <Card className={classNames(styles.notice, styles.noticeRow)} radius="sm" variant="warning-outline">
          <strong>This code expired</strong>
          <Button
            color="accent1"
            disabled={resendCountdown.isCountingDown}
            loading={isResending}
            onClick={handleResend}
            size="sm"
          >
            {resendCountdown.isCountingDown
              ? `Send a new code in ${resendCountdown.remainingCountdown}s`
              : 'Send a new code'}
          </Button>
        </Card>
      );
    }
    return (
      <>
        {isInvalid ? (
          <span className={styles.errorText} role="alert">
            That code isn&apos;t right. {state.attemptsLeft} {state.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.
          </span>
        ) : null}
        <div className={styles.spread}>
          <span className={styles.muted}>
            {expiresAt !== null ? `Expires in ${formatMinutesSeconds(expiryCountdown.remainingCountdown)}. ` : ''}
            Not there? Check spam.
          </span>
          {resendCountdown.isCountingDown ? (
            <span className={styles.muted}>Resend code in {resendCountdown.remainingCountdown}s</span>
          ) : (
            <button className={styles.linkButton} disabled={isResending} onClick={handleResend} type="button">
              Resend code
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <Card className={styles.root} direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
      <div className={styles.heading}>
        <h3>Verify your email</h3>
        <span className={styles.muted}>
          Enter the {CODE_LENGTH}-digit code we emailed you. It ensures you have access to the provided email address.
        </span>
      </div>

      <Card className={styles.codeCard} innerShadow="black" radius="sm" variant="glass">
        <div className={styles.emailRow}>
          <span className={styles.emailIcon}>
            <MailOutlineIcon />
          </span>
          <span className={styles.muted}>
            Code sent to <strong className={styles.email}>{email}</strong>
            <Link className={styles.link} href="/subsidy/details">
              Change
            </Link>
          </span>
        </div>
        {isLocked ? null : (
          <TwoFactorInput
            aria-label="Email verification code"
            disabled={isExpired || isSubmitting}
            error={isInvalid}
            onChange={handleCodeChange}
            value={code}
          />
        )}
        {renderStatus()}
      </Card>

      <div className="actionsGroupMdBetween">
        <Button color="accent1" href="/subsidy/details" size="md" variant="transparent">
          Back to details
        </Button>
        <Button
          color="accent1"
          disabled={code.length !== CODE_LENGTH || isInvalid || isLocked || isExpired}
          loading={isSubmitting}
          onClick={() => submitCode(code)}
          size="md"
          variant="filled"
        >
          Verify email
        </Button>
      </div>
    </Card>
  );
};

export default Verify;
