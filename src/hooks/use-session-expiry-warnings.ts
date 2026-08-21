import { useOceanAccount } from '@/lib/use-ocean-account';
import {
  bandFor,
  readSessions,
  REGISTRY_EVENT,
  rememberSession,
  TrackedSession,
  WARN_WINDOW_SECONDS,
} from '@/services/session-expiry';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type ExpiringSession = TrackedSession & {
  remainingSeconds: number;
  band: number;
};

/** 1Hz only while something is actually inside the warning window. */
const TICK_ACTIVE_MS = 1000;
/** Otherwise a slow heartbeat, so a live 1-hour session doesn't re-render app-wide chrome 3600 times. */
const TICK_IDLE_MS = 15000;

/**
 * Watches every tracked session's deadline and reports the ones inside a warning band.
 *
 * The one rule that makes this work: **never count intervals**. `remaining` is always
 * `expiresAt - Date.now()`, and the interval exists only to schedule a re-render. Browsers clamp
 * hidden-tab timers to one tick a minute (Chrome, after 5 minutes hidden) or pause them outright
 * (Safari), so a counter that accumulated ticks would drift far enough to never reach the threshold
 * at all. Reading the clock instead makes a throttled tab produce a *late render* of a *correct
 * value*, and the visibility listeners force that render the instant the tab is looked at again.
 *
 * Pure state — delivery (banner, toast, OS notification) belongs to the notifier component.
 */
export default function useSessionExpiryWarnings(): {
  expiring: ExpiringSession[];
  dismiss: (session: ExpiringSession) => void;
} {
  const { account } = useOceanAccount();
  const address = account.address;

  // Registry snapshot. Read only in effects, so the server render and the first client render both
  // see [] and there's no hydration mismatch (same approach as legacy-escrow-banner).
  const [sessions, setSessions] = useState<TrackedSession[]>([]);
  useEffect(() => {
    if (!address) {
      setSessions([]);
      return;
    }
    const sync = () => setSessions(readSessions(address));
    sync();
    window.addEventListener('storage', sync); // another tab wrote
    window.addEventListener(REGISTRY_EVENT, sync); // this tab wrote
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(REGISTRY_EVENT, sync);
    };
  }, [address]);

  const [now, setNow] = useState(() => Date.now());

  const soonestRemaining = useMemo(
    () => sessions.reduce((min, session) => Math.min(min, (session.expiresAt - now) / 1000), Number.POSITIVE_INFINITY),
    [sessions, now]
  );

  const tickMs = soonestRemaining <= WARN_WINDOW_SECONDS ? TICK_ACTIVE_MS : TICK_IDLE_MS;

  useEffect(() => {
    if (sessions.length === 0) {
      return;
    }
    const resync = () => setNow(Date.now());
    const timer = setInterval(resync, tickMs);
    // The interval alone is not enough: it can be throttled or paused while hidden. These force an
    // immediate recompute the moment the tab is looked at again. `pageshow` covers a Safari bfcache
    // restore, where neither of the others reliably fires.
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, [tickMs, sessions.length]);

  const expiring = useMemo(
    () =>
      sessions
        .map((session) => {
          const remainingSeconds = Math.floor((session.expiresAt - now) / 1000);
          return { ...session, remainingSeconds, band: bandFor(session, remainingSeconds) };
        })
        .filter(
          (session): session is ExpiringSession => session.band !== null && session.dismissedBand !== session.band
        )
        .sort((a, b) => a.remainingSeconds - b.remainingSeconds),
    [sessions, now]
  );

  // Persisted on the record rather than in component state, so it survives a reload and syncs to
  // other tabs through the storage event. Storing the *band* is what lets the final warning break
  // through an earlier dismissal: dismissing at T-10 sets 600, and at T-1 the band is 60.
  const dismiss = useCallback(
    (session: ExpiringSession) => {
      rememberSession(address, { serviceId: session.serviceId, dismissedBand: session.band });
    },
    [address]
  );

  return { expiring, dismiss };
}
