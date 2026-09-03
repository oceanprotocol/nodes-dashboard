import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useSessionExpiryWarnings, { ExpiringSession } from '@/hooks/use-session-expiry-warnings';
import { ensureRegistration, isOptedIn, showSessionNotification } from '@/lib/notifications';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { prolongHref, URGENT_BAND_SECONDS } from '@/services/session-expiry';
import { formatHMS } from '@/utils/formatters';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import styles from './session-expiry-notifier.module.css';

/** Identity of one warning. Including `expiresAt` means a prolong re-arms every band for free. */
function warningKey(session: ExpiringSession): string {
  return `${session.serviceId}:${session.expiresAt}:${session.band}`;
}

function toastMessage(session: ExpiringSession): string {
  return session.band <= URGENT_BAND_SECONDS
    ? 'ends in under a minute. Save your work, as the endpoint will stop responding.'
    : 'ends in about 10 minutes. Prolong it to keep it running.';
}

/**
 * App-wide expiry warnings: a banner that persists, a toast on each threshold crossing, and — for
 * anyone who opted in — an OS notification so the message lands while the tab is not being looked at.
 *
 * Mounted in RootLayout rather than behind a new context provider: it renders inside every provider
 * already, and the only consumer of this state is the component rendering it.
 */
const SessionExpiryNotifier: React.FC = () => {
  const { expiring, dismiss } = useSessionExpiryWarnings();
  const { account } = useOceanAccount();
  const address = account.address;

  // A reload clears whatever the worker registered last time, so re-establish it for anyone who has
  // opted in — otherwise `showNotification` has nothing to talk to until they revisit a manage page.
  useEffect(() => {
    if (isOptedIn(address)) {
      ensureRegistration().catch(() => {
        // Blocked worker; the banner and toast still work.
      });
    }
  }, [address]);

  // Mirror for the delivery effect below. Declared BEFORE it so it is already current when that
  // effect runs in the same commit.
  const expiringRef = useRef(expiring);
  useEffect(() => {
    expiringRef.current = expiring;
  }, [expiring]);

  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    firedRef.current = new Set();
  }, [address]);

  // Depends on the joined key string rather than the array, so it runs on a band transition instead
  // of once a second.
  const bandKey = expiring.map(warningKey).join('|');
  useEffect(() => {
    for (const session of expiringRef.current) {
      const key = warningKey(session);
      if (firedRef.current.has(key)) {
        continue;
      }
      firedRef.current.add(key);

      toast.warning(
        <span>
          <strong>{session.label}</strong> {toastMessage(session)}{' '}
          <Link href={prolongHref(session)}>Prolong session</Link>
        </span>,
        {
          // Load-bearing: without an id a re-render storm stacks identical warnings.
          toastId: key,
          // A warning that closes itself while the tab is in the background is no warning at all.
          autoClose: false,
        }
      );

      if (isOptedIn(address)) {
        void showSessionNotification({
          title:
            session.band <= URGENT_BAND_SECONDS ? 'Session ending in under a minute' : 'Session ending in 10 minutes',
          body: `${session.label}: ${
            session.band <= URGENT_BAND_SECONDS
              ? 'the endpoint is about to stop responding.'
              : 'prolong it to keep it running.'
          }`,
          // Stable per session, so the one-minute warning replaces the ten-minute one.
          tag: `session-${session.serviceId}`,
          url: prolongHref(session),
        });
      }
    }
  }, [bandKey, address]);

  const soonest = expiring[0];
  if (!soonest) {
    return null;
  }

  const urgent = soonest.band <= URGENT_BAND_SECONDS;

  return (
    <Container>
      <Card className={styles.root} direction="column" radius="md" role="status" variant={urgent ? 'error' : 'warning'}>
        <div className={styles.row}>
          <AccessTimeOutlinedIcon className={styles.icon} />
          <span className={styles.message}>
            <strong>{soonest.label}</strong> ends in{' '}
            <span className={styles.countdown}>{formatHMS(soonest.remainingSeconds)}</span>
            {expiring.length > 1 ? ` · ${expiring.length - 1} more ending soon` : null}
          </span>
          <Button className={styles.action} href={prolongHref(soonest)} size="sm" variant="outlined">
            Prolong session
          </Button>
          <IconButton
            aria-label="Dismiss session expiry warning"
            className={styles.close}
            onClick={() => dismiss(soonest)}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
      </Card>
    </Container>
  );
};

export default SessionExpiryNotifier;
