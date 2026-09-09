/**
 * OS-level notifications for session expiry.
 *
 * Everything goes through the service worker's `showNotification`, never the page-level
 * `new Notification()` constructor — that throws outright on Chrome for Android, and notification
 * action buttons and click handling only exist on the worker path anyway.
 */

const SW_URL = '/sw.js';

/** Opt-in flag, per wallet. Permission alone isn't consent to notify about *this* session. */
const OPT_IN_PREFIX = 'session-expiry-notify';

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

function optInKey(address: string): string {
  return `${OPT_IN_PREFIX}-${address.toLowerCase()}`;
}

export function isSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext
  );
}

export function notifyState(): NotifyState {
  if (!isSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotifyState;
}

export function isOptedIn(address?: string): boolean {
  if (!address) {
    return false;
  }
  try {
    return localStorage.getItem(optInKey(address)) === 'true';
  } catch {
    return false;
  }
}

export function setOptedIn(address: string | undefined, value: boolean): void {
  if (!address) {
    return;
  }
  try {
    localStorage.setItem(optInKey(address), value ? 'true' : 'false');
  } catch {
    // Best-effort; without persistence the toggle just doesn't survive a reload.
  }
}

let registration: Promise<ServiceWorkerRegistration> | null = null;

/**
 * Register (once) and resolve when the worker is usable. Only ever called for someone who has opted
 * in — there's no reason to hand every visitor a service worker.
 */
export function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  if (!registration) {
    registration = navigator.serviceWorker.register(SW_URL).then(() => navigator.serviceWorker.ready);
  }
  return registration;
}

/**
 * Ask for permission and register the worker.
 *
 * MUST be called synchronously from a real user gesture: Safari shows no prompt at all otherwise,
 * and a refusal is permanent per origin — it cannot be asked for a second time. Chrome additionally
 * demotes the prompt on origins with poor accept rates, so this belongs behind an explicit control
 * shown at a moment that earns it, never on page load.
 */
export async function enableNotifications(): Promise<NotifyState> {
  if (!isSupported()) {
    return 'unsupported';
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission as NotifyState;
  }
  try {
    await ensureRegistration();
  } catch {
    // Registration can fail (blocked worker, private mode). Permission is still granted; the
    // in-app banner keeps working, so report the grant rather than inventing a denial.
  }
  return 'granted';
}

/**
 * Show one expiry notification. Returns false when it couldn't be shown, so the caller can rely on
 * the in-app banner alone.
 */
export async function showSessionNotification(options: {
  title: string;
  body: string;
  /** Stable per session, so a later warning REPLACES an earlier one instead of stacking. */
  tag: string;
  url: string;
}): Promise<boolean> {
  if (!isSupported() || Notification.permission !== 'granted') {
    return false;
  }
  try {
    const ready = await ensureRegistration();
    await ready.showNotification(options.title, {
      body: options.body,
      tag: options.tag,
      data: { url: options.url },
      icon: '/logo.svg',
      badge: '/logo.svg',
      // Same tag replaces silently by default; this makes the T-1 warning actually alert.
      renotify: true,
      // The whole scenario is a machine nobody is sitting at, so it must not auto-dismiss.
      requireInteraction: true,
    } as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}
