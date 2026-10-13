import Button from '@/components/button/button';
import Card from '@/components/card/card';
import TwoFactorInput from '@/components/input/two-factor-input';
import { useGrantContext } from '@/context/grant-context';
import { useProfileContext } from '@/context/profile-context';
import useCountdown from '@/hooks/use-countdown';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { GRANT_OTP_RESEND_COOLDOWN_SECONDS, GrantVerifyError, GrantVerifyErrorResponse } from '@/types/grant';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import axios from 'axios';
import classNames from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './verify.module.css';

type VerifyState = { attemptsLeft?: number; error?: GrantVerifyError };

const secondsUntil = (timestamp: number | undefined) =>
  timestamp ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : 0;

const formatMinutesSeconds = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

const Verify: React.FC = () => {
  const { account } = useOceanAccount();
  const router = useRouter();
  const { grantDetails } = useGrantContext();
  const { fetchGrantStatus, grantInfo } = useProfileContext();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [state, setState] = useState<VerifyState>({});
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const expiryCountdown = useCountdown(0);
  const resendCountdown = useCountdown(GRANT_OTP_RESEND_COOLDOWN_SECONDS);

  const email = grantDetails?.email ?? grantInfo?.maskedEmail ?? '';
  const emailChanged = router.query.emailChanged === '1';

  const { initiateCountdown: initiateExpiry } = expiryCountdown;
  const { initiateCountdown: initiateResend } = resendCountdown;

  useEffect(() => {
    if (grantInfo?.otpExpires) {
      setExpiresAt(grantInfo.otpExpires);
      initiateExpiry(secondsUntil(grantInfo.otpExpires));
    }
    if (grantInfo?.otpLastResent) {
      initiateResend(secondsUntil(grantInfo.otpLastResent + GRANT_OTP_RESEND_COOLDOWN_SECONDS * 1000));
    }
    if (grantInfo?.otpLocked) {
      setState({ error: GrantVerifyError.LOCKED });
    }
  }, [grantInfo?.otpExpires, grantInfo?.otpLastResent, grantInfo?.otpLocked, initiateExpiry, initiateResend]);

  const isLocked = state.error === GrantVerifyError.LOCKED;
  const isExpired =
    !isLocked && (state.error === GrantVerifyError.EXPIRED || (expiresAt !== null && !expiryCountdown.isCountingDown));
  const isInvalid = state.error === GrantVerifyError.INVALID_CODE;

  const submitCode = useCallback(
    async (value: string) => {
      setIsSubmitting(true);
      try {
        await axios.post('/api/grant/verify', {
          code: value,
          email: grantDetails?.email,
          walletAddress: account.address,
        });
        posthog.capture('grant_email_verified');
        // The step guard moves on to Claim once the refreshed status is verified.
        await fetchGrantStatus(account.address!);
      } catch (error) {
        const body = axios.isAxiosError(error) ? (error.response?.data as GrantVerifyErrorResponse) : undefined;
        if (body?.error) {
          setState({ attemptsLeft: body.attemptsLeft, error: body.error });
        } else {
          toast.error(body?.message ?? 'Failed to verify code. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [account.address, fetchGrantStatus, grantDetails?.email]
  );

  const handleCodeChange = (value: string) => {
    if (isInvalid) {
      setState({});
    }
    setCode(value);
    if (value.length === 6 && !isSubmitting) {
      submitCode(value);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await axios.post<{ otpExpires?: number; retryAfter?: number; sent: boolean }>(
        '/api/grant/resend-otp',
        { walletAddress: account.address }
      );
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
            {expiresAt !== null ? `Expires in ${formatMinutesSeconds(expiryCountdown.remainingCountdown)} · ` : ''}
            Can&apos;t find it? Check spam.
          </span>
          {resendCountdown.isCountingDown ? (
            <span className={styles.muted}>Resend code in {resendCountdown.remainingCountdown}s</span>
          ) : (
            <button className={styles.linkButton} disabled={isResending} onClick={handleResend} type="button">
              Resend code
            </button>
          )}
        </div>
        <Button
          className={styles.submit}
          color="accent1"
          disabled={code.length !== 6 || isInvalid}
          loading={isSubmitting}
          onClick={() => submitCode(code)}
          size="md"
        >
          Verify email
        </Button>
      </>
    );
  };

  return (
    <Card className={styles.root} direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
      <div className={styles.heading}>
        <h3>Verify your email</h3>
        <span className={styles.muted}>One quick code. We use it only to keep one subsidy per person.</span>
      </div>

      {emailChanged ? (
        <Card className={styles.changedNote} radius="sm" variant="glass">
          <InfoOutlinedIcon fontSize="small" />
          <span>You changed your email, so the new address needs a code.</span>
        </Card>
      ) : null}

      <Card className={styles.codeCard} radius="md" variant="accent1-outline">
        <div className={styles.emailRow}>
          <span className={styles.emailIcon}>
            <MailOutlineIcon />
          </span>
          <div className={styles.emailText}>
            <strong>Email</strong>
            <span className={styles.muted}>
              Enter the 6-digit code sent to <strong className={styles.email}>{email}</strong>{' '}
              <Link className={styles.link} href="/grant/details">
                Change
              </Link>
            </span>
          </div>
          <span className="chip chipWarning">Code sent</span>
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

      <Button className={styles.back} color="accent1" href="/grant/details" size="md" variant="transparent">
        Back to details
      </Button>
    </Card>
  );
};

export default Verify;
