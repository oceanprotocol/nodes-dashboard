import Button from '@/components/button/button';
import Input from '@/components/input/input';
import TwoFactorInput, { CODE_LENGTH } from '@/components/input/two-factor-input';
import { isAlchemyMigrationUser, needsEmbeddedWallet } from '@/lib/embedded-wallet';
import { LOGIN_PATH, useOceanAccount } from '@/lib/use-ocean-account';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import KeyIcon from '@mui/icons-material/Key';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { CircularProgress } from '@mui/material';
import { useMigration } from '@privy-io/alchemy-migration';
import {
  useCreateWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithPasskey,
  usePrivy,
  useSignupWithPasskey,
  type User,
} from '@privy-io/react-auth';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './login-page.module.css';
import WalletList from './wallet-list';

type Method = 'email' | 'google' | 'passkey' | 'passkey-signup';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_HINT = 'We will send you a 6-digit code. No password to remember.';
const SIGN_IN_TIMEOUT_MS = 45_000;

const getSafeNext = (next: string | string[] | undefined) => {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith(LOGIN_PATH)) {
    return '/';
  }
  return next;
};

const LoginPage = () => {
  const router = useRouter();
  const { account, loginOptions } = useOceanAccount();
  const { authenticated, logout: privyLogout, ready: privyReady, user: privyUser } = usePrivy();
  const { hasDismissed: migrationDismissed, isOpen: migrationOpen } = useMigration();

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [codeSentTo, setCodeSentTo] = useState<string>();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [finishing, setFinishing] = useState(false);
  const [pending, setPending] = useState<Method | null>(null);
  const [resent, setResent] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  const fail = useCallback((message: string) => {
    toast.error(message);
    setFinishing(false);
    setPending(null);
  }, []);

  // Back to the form without a half-finished Privy session, which would block the next login.
  const abortSignIn = useCallback(
    (message: string) => {
      fail(message);
      setCodeSentTo(undefined);
      privyLogout().catch(() => {});
    },
    [fail, privyLogout]
  );
  const abortSignInRef = useRef(abortSignIn);
  abortSignInRef.current = abortSignIn;

  const { createWallet } = useCreateWallet();
  // Privy's modal creates the embedded wallet after login; the headless hooks do not.
  const callbacks = useMemo(
    () => ({
      onComplete: async ({ user, wasAlreadyAuthenticated }: { user: User; wasAlreadyAuthenticated: boolean }) => {
        // Privy also reports a session restored on page load here, which is not a login attempt.
        if (wasAlreadyAuthenticated) {
          return;
        }
        setFinishing(true);
        if (!needsEmbeddedWallet(user)) {
          return;
        }
        try {
          await createWallet();
        } catch (cause) {
          console.error('Wallet creation failed:', cause);
          abortSignInRef.current('Could not create your wallet. Try again.');
        }
      },
    }),
    [createWallet]
  );
  const { loginWithCode, sendCode, state: emailState } = useLoginWithEmail(callbacks);
  const { initOAuth, state: oauthState } = useLoginWithOAuth(callbacks);
  const { loginWithPasskey } = useLoginWithPasskey(callbacks);
  const { signupWithPasskey } = useSignupWithPasskey(callbacks);

  const isMigrating = authenticated && !!privyUser && isAlchemyMigrationUser(privyUser) && !account.isConnected;
  useEffect(() => {
    if (isMigrating && migrationDismissed) {
      abortSignInRef.current('Account migration was cancelled. Log in again to continue.');
    }
  }, [isMigrating, migrationDismissed]);

  const isWaiting = finishing && !account.isConnected && !migrationOpen;
  useEffect(() => {
    if (!isWaiting) {
      return;
    }
    const timer = setTimeout(() => abortSignInRef.current('Signing in took too long. Try again.'), SIGN_IN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isWaiting]);

  // Only a Google redirect landing here reports through state; a failed start throws instead.
  const returningFromGoogle = useRef(
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('privy_oauth_code')
  );
  useEffect(() => {
    if (!returningFromGoogle.current || oauthState.status !== 'error') {
      return;
    }
    returningFromGoogle.current = false;
    fail('Google sign-in failed. Try again.');
  }, [fail, oauthState.status]);

  const redirected = useRef(false);
  useEffect(() => {
    if (!account.isConnected || !router.isReady || redirected.current) {
      return;
    }
    redirected.current = true;
    router.replace(getSafeNext(router.query.next));
  }, [account.isConnected, router]);

  const isSubmittingCode = emailState.status === 'submitting-code';
  const submittedCode = useRef<string | null>(null);
  useEffect(() => {
    if (!codeSentTo || code.length !== CODE_LENGTH || submittedCode.current === code) {
      return;
    }
    submittedCode.current = code;
    loginWithCode({ code }).catch(() => setCodeError('That code did not match. Check the email and try again.'));
  }, [code, codeSentTo, loginWithCode]);

  const startPrivy = (method: Method, start: () => Promise<void>, failure: string) => {
    if (!loginOptions) {
      return;
    }
    setPending(method);
    loginOptions.startPrivyLogin(
      async () => {
        try {
          await start();
          setPending(null);
        } catch (cause) {
          console.error('Login failed:', cause);
          fail(failure);
        }
      },
      () => fail(failure)
    );
  };

  const handleEmailSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    startPrivy(
      'email',
      async () => {
        await sendCode({ email: trimmed });
        setCode('');
        setCodeError(undefined);
        setResent(false);
        setCodeSentTo(trimmed);
      },
      'Could not send the code. Check the email and try again.'
    );
  };

  const handleResend = async () => {
    if (!codeSentTo) {
      return;
    }
    setCodeError(undefined);
    try {
      await sendCode({ email: codeSentTo });
      submittedCode.current = null;
      setCode('');
      setResent(true);
    } catch {
      setCodeError('Could not send a new code. Try again in a moment.');
    }
  };

  const handleCodeChange = (value: string) => {
    submittedCode.current = null;
    setCode(value);
    setCodeError(undefined);
  };

  if (account.isConnected || finishing || oauthState.status === 'loading' || (isMigrating && !migrationDismissed)) {
    return (
      <div className={styles.root}>
        <div className={styles.status} role="status">
          <CircularProgress size={32} />
          <p>Signing you in</p>
        </div>
      </div>
    );
  }

  if (codeSentTo) {
    return (
      <div className={styles.root}>
        <div className={styles.step}>
          <h1>
            Check your <em>inbox</em>
          </h1>
          <p className={styles.lead}>
            Enter the 6-digit code we sent to <strong>{codeSentTo}</strong>.
          </p>
          <div className={styles.code}>
            <TwoFactorInput
              aria-label="6-digit code"
              disabled={isSubmittingCode}
              error={!!codeError}
              onChange={handleCodeChange}
              value={code}
            />
          </div>
          <p className={codeError ? styles.messageError : styles.message} role="status">
            {isSubmittingCode ? 'Checking code' : (codeError ?? (resent ? 'We sent you a new code.' : ''))}
          </p>
          <div className={styles.row}>
            <Button autoLoading onClick={handleResend} size="md" variant="transparent">
              Resend code
            </Button>
            <Button onClick={() => setCodeSentTo(undefined)} size="md" variant="transparent">
              Use a different email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const privyUnavailable = !!loginOptions?.privyUnavailable;
  const privyDisabled = !privyReady || !!pending;

  return (
    <div className={styles.root}>
      <div className={styles.step}>
        <h1>
          Log in or <em>sign up</em>
        </h1>
        <p className={styles.lead}>One account for models, templates and compute. No wallet needed to start.</p>
        <div className={styles.stack}>
          {privyUnavailable ? (
            <p className={styles.message}>Email, Google and passkey login is unavailable right now.</p>
          ) : (
            <>
              <Button
                className={styles.full}
                contentBefore={<GoogleIcon />}
                disabled={privyDisabled}
                loading={pending === 'google'}
                onClick={() =>
                  startPrivy('google', () => initOAuth({ provider: 'google' }), 'Could not reach Google. Try again.')
                }
                size="lg"
                variant="outlined"
              >
                Continue with Google
              </Button>
              <div className={styles.or}>or</div>
              <form className={styles.stack} noValidate onSubmit={handleEmailSubmit}>
                <Input
                  errorText={emailError}
                  hint={emailError ? undefined : EMAIL_HINT}
                  label="Email"
                  name="email"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError(undefined);
                  }}
                  placeholder="you@company.com"
                  startAdornment={<MailOutlineIcon className={styles.inputIcon} />}
                  type="email"
                  value={email}
                />
                <Button
                  className={styles.full}
                  color="accent1"
                  disabled={privyDisabled}
                  loading={pending === 'email'}
                  size="lg"
                  type="submit"
                >
                  Continue with email
                </Button>
              </form>
              <div className={styles.passkeys}>
                <Button
                  contentBefore={<KeyIcon />}
                  disabled={privyDisabled}
                  loading={pending === 'passkey'}
                  onClick={() =>
                    startPrivy('passkey', () => loginWithPasskey(), 'Passkey login was cancelled or failed. Try again.')
                  }
                  size="md"
                  variant="transparent"
                >
                  Log in with a passkey
                </Button>
                <Button
                  disabled={privyDisabled}
                  loading={pending === 'passkey-signup'}
                  onClick={() =>
                    startPrivy(
                      'passkey-signup',
                      () => signupWithPasskey(),
                      'Passkey sign-up was cancelled or failed. Try again.'
                    )
                  }
                  size="md"
                  variant="transparent"
                >
                  Sign up with a passkey
                </Button>
              </div>
            </>
          )}
          {loginOptions &&
            (showWallets || privyUnavailable ? (
              <WalletList
                error={loginOptions.walletError}
                isConnecting={loginOptions.isConnectingWallet}
                onConnect={loginOptions.connectWallet}
                wallets={loginOptions.wallets}
              />
            ) : (
              <Button
                className={styles.full}
                contentBefore={<AccountBalanceWalletOutlinedIcon />}
                onClick={() => setShowWallets(true)}
                size="md"
                variant="transparent"
              >
                Connect a crypto wallet instead
              </Button>
            ))}
          <p className={styles.fine}>
            Read our <Link href="/privacy-policy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
