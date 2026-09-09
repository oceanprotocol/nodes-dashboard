/**
 * Registry of every service session this browser has seen, so an expiry warning can follow the user
 * across pages instead of living only on the manage page's countdown bar.
 *
 * Deliberately localStorage rather than a fetch: the manage page already polls the node every 4s and
 * holds its authoritative `expiresAt`, so recording from there costs one effect, needs no auth, and
 * can't be made stale by a backend record the node hasn't reconciled yet. It also makes every state
 * seedable from the console — the only way this is testable in a repo with no test harness.
 */

export type TrackedSession = {
  serviceId: string;
  /** Epoch MS, straight off the node's job record (`job.expiresAt`). */
  expiresAt: number;
  /** Epoch MS, `job.dateCreated` parsed. Sizes the bands — see `bandFor`. */
  startedAt: number;
  /** Manage-page URL as recorded, so the warning's CTA can deep-link back with full query state. */
  href: string;
  /** Service / template / model name, for the warning copy. */
  label: string;
  /** `ServiceStatusNumber`, last seen. */
  status?: number;
  /** Band the user dismissed in, so a later (narrower) band still breaks through. */
  dismissedBand?: number;
};

/**
 * Seconds-remaining thresholds, widest first.
 *
 * 600 is actionable: prolonging routes through an escrow top-up and up to two on-chain
 * confirmations, which is 1–5 minutes, so ten leaves roughly 2x headroom. 60 is terminal — not
 * "you can still extend" but "the endpoint is about to stop answering".
 */
export const WARN_BANDS_SECONDS = [600, 60] as const;

/** The widest band — outside this, nothing needs a 1Hz clock. */
export const WARN_WINDOW_SECONDS = WARN_BANDS_SECONDS[0];

/** The narrowest band, rendered as an error rather than a warning. */
export const URGENT_BAND_SECONDS = WARN_BANDS_SECONDS[WARN_BANDS_SECONDS.length - 1];

/**
 * A band only arms if the session's whole window was meaningfully longer than it — otherwise a
 * 5-minute session would fire its "10 minutes left" warning the instant it launched.
 */
const BAND_MIN_TOTAL_RATIO = 1.5;

/** Entries are dropped this long after their deadline, so the registry can't grow forever. */
const RETENTION_MS = 60 * 60 * 1000;

/**
 * Same-tab change notification. The `storage` event fires in *other* tabs only, so a write here
 * would otherwise be invisible to the notifier mounted in this one.
 */
export const REGISTRY_EVENT = 'session-expiry-updated';

/**
 * Injected wallets hand back checksummed addresses while the services API is called lowercased, and
 * the same account can surface either way. Key without normalising and the registry silently
 * orphans itself on reconnect — the sessions are still there, under an address that no longer
 * matches. See the same discipline in `context/node-tokens`.
 */
function storageKey(address: string): string {
  return `session-expiry-${address.toLowerCase()}`;
}

/** Every tracked session for `address`, expired-and-stale entries already dropped. */
export function readSessions(address?: string): TrackedSession[] {
  if (!address) {
    return [];
  }
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Record<string, TrackedSession>;
    const cutoff = Date.now() - RETENTION_MS;
    return Object.values(parsed).filter(
      (session) =>
        !!session &&
        typeof session.serviceId === 'string' &&
        Number.isFinite(session.expiresAt) &&
        session.expiresAt > cutoff
    );
  } catch {
    // Corrupt payload, or localStorage throwing outright (Safari private mode, restricted iframe).
    // The feature no-ops rather than taking the page down with it.
    return [];
  }
}

/**
 * Merge one session in.
 *
 * `expiresAt` only ever moves forward — extending pushes it out and nothing moves it back — so
 * `max()` is provably safe and no stale writer can shorten a deadline. That also makes a forward
 * jump unambiguous evidence of a prolong, which is why it clears the dismissal: every band re-arms
 * itself for the new deadline with no reset logic anywhere.
 */
export function rememberSession(
  address: string | undefined,
  next: Partial<TrackedSession> & { serviceId: string }
): void {
  if (!address) {
    return;
  }
  try {
    const byId = Object.fromEntries(readSessions(address).map((session) => [session.serviceId, session]));
    const prev = byId[next.serviceId];
    const merged = {
      ...prev,
      ...next,
      expiresAt: Math.max(prev?.expiresAt ?? 0, next.expiresAt ?? 0),
    } as TrackedSession;
    if (prev && merged.expiresAt > prev.expiresAt) {
      delete merged.dismissedBand;
    }
    byId[next.serviceId] = merged;
    localStorage.setItem(storageKey(address), JSON.stringify(byId));
    window.dispatchEvent(new Event(REGISTRY_EVENT));
  } catch {
    // Persistence is best-effort; a blocked store just means no cross-page warning.
  }
}

/**
 * The narrowest band `remainingSeconds` has fallen inside, or null when the session is outside the
 * warning window, already expired, or too short for any band to have armed.
 */
export function bandFor(session: TrackedSession, remainingSeconds: number): number | null {
  if (remainingSeconds <= 0) {
    return null;
  }
  const totalSeconds = (session.expiresAt - session.startedAt) / 1000;
  // Narrowest first, so a session inside both bands reports 60 rather than 600.
  for (const band of [...WARN_BANDS_SECONDS].sort((a, b) => a - b)) {
    if (remainingSeconds <= band) {
      return totalSeconds > band * BAND_MIN_TOTAL_RATIO ? band : null;
    }
  }
  return null;
}

/**
 * CTA target: the recorded manage-page URL, flagged so the page opens with the prolong modal already
 * up. Deliberately a different param from the payment page's own `prolong=1`.
 */
export function prolongHref(session: TrackedSession): string {
  const base = session.href.replace(/([?&])openProlong=1&?/, '$1').replace(/[?&]$/, '');
  return base.includes('?') ? `${base}&openProlong=1` : `${base}?openProlong=1`;
}
