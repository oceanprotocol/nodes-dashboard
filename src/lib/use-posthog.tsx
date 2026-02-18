'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init("phc_hD7bhooFbRUWqSWOvRAZiHv4tr6mYYgleeWGkQ52eWD", {
      api_host: "https://eu.i.posthog.com",
      defaults: '2026-01-30',
      capture_exceptions: true,
    })
    //posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    //  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    //  defaults: '2026-01-30',
    //  capture_exceptions: true,
    //})
  }, [])

  return (
      <PostHogProvider client={posthog}>
        {children}
      </PostHogProvider>
  );
}
