'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

declare global {
  interface Window {
    Cookiebot?: {
      consent?: {
        statistics?: boolean
      }
    }
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initPostHog = () => {
      if (window.Cookiebot?.consent?.statistics) {
        posthog.init("phc_hD7bhooFbRUWqSWOvRAZiHv4tr6mYYgleeWGkQ52eWD", {
          api_host: "https://eu.i.posthog.com",
          defaults: '2026-01-30',
          capture_exceptions: true,
        })
      }
    }

    initPostHog()

    window.addEventListener('CookiebotOnAccept', initPostHog)
    return () => window.removeEventListener('CookiebotOnAccept', initPostHog)
  }, [])

  return (
      <PostHogProvider client={posthog}>
        {children}
      </PostHogProvider>
  );
}
