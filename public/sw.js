/**
 * Session-expiry notifications worker.
 *
 * Deliberately minimal, and deliberately WITHOUT a `fetch` handler. A worker that cannot intercept
 * requests cannot serve a stale bundle, so the usual way a service worker bricks a deploy is
 * designed out rather than guarded against. Do not add caching here — this file exists only to own
 * notification clicks (and, later, push events).
 *
 * Served from /public, so it lands at /sw.js and gets root scope for free.
 */

self.addEventListener('install', () => {
  // No caches to warm, so there is nothing to wait for — take over immediately rather than sitting
  // in `waiting` until every tab closes.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/inference';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      // Reuse the dashboard tab if one is open, so clicking a warning doesn't pile up duplicates.
      if (existing) {
        // `navigate` only works on clients this worker controls. A tab loaded before the worker
        // activated is uncontrolled and throws, so fall through to focusing it as-is.
        if ('navigate' in existing) {
          try {
            const navigated = await existing.navigate(target);
            if (navigated) {
              return navigated.focus();
            }
          } catch {
            // uncontrolled client — focus without navigating
          }
        }
        return existing.focus();
      }

      return self.clients.openWindow(target);
    })()
  );
});
