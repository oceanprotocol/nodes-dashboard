'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

declare global {
  interface Window {
    Cookiebot?: {
      consent?: {
        statistics?: boolean;
      };
    };
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function hideUnusedCookieOptions() {
      const categories = ['Preferences', 'Marketing'];

      for (const category of categories) {
        (
          document.getElementById(`CybotCookiebotDialogBodyLevelButton${category}`)?.parentNode as HTMLElement
        ).style.display = 'none';
        (document.getElementById(`CybotCookiebotDialogBodyLevelButton${category}`) as HTMLInputElement).checked = false;
        (
          document.querySelector(`label[for=CybotCookiebotDialogBodyLevelButton${category}]`)?.parentNode as HTMLElement
        ).style.display = 'none';
      }
    }

    function initPostHog() {
      if (window.Cookiebot?.consent?.statistics) {
        posthog.init('phc_hD7bhooFbRUWqSWOvRAZiHv4tr6mYYgleeWGkQ52eWD', {
          api_host: 'https://eu.i.posthog.com',
          defaults: '2026-01-30',
          capture_exceptions: true,
          enable_heatmaps: true,
        });
      }
    }

    function optOutCapturing() {
      if (!window.Cookiebot?.consent?.statistics) {
        posthog.opt_out_capturing();
      }
    }

    initPostHog();

    window.addEventListener('CookiebotOnDialogDisplay', hideUnusedCookieOptions);
    window.addEventListener('CookiebotOnAccept', initPostHog);
    window.addEventListener('CookiebotOnDecline', optOutCapturing);
    return () => {
      window.removeEventListener('CookiebotOnDialogDisplay', hideUnusedCookieOptions);
      window.removeEventListener('CookiebotOnAccept', initPostHog);
      window.removeEventListener('CookiebotOnDecline', optOutCapturing);
    };
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
