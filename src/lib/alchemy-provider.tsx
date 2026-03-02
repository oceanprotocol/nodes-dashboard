'use client';

import { config, queryClient } from '@/lib/config';
import { cookieToInitialState } from '@account-kit/core';
import { AlchemyAccountProvider } from '@account-kit/react';
import { useMemo } from 'react';

export function AlchemyProvider({ children, cookie }: { children: React.ReactNode; cookie?: string }) {
  const initialState = useMemo(() => {
    try {
      const state = cookie ? cookieToInitialState(config, cookie) : undefined;

      // If the user has a corrupt or legacy cookie in their browser
      // it might parse successfully but lack the expected Map object for connections.
      // Passing this corrupted state to the AlchemyAccountProvider will crash SSR.
      // Therefore, if it's invalid, we discard it to force a clean reset.
      if (state?.alchemy?.connections && !(state.alchemy.connections instanceof Map)) {
        console.warn(
          '[AlchemyProvider] Corrupt state detected from cookies (connections is not a Map). Discarding state to prevent crash.'
        );
        return undefined; // Discard corrupt state
      }

      return state;
    } catch (e) {
      console.warn('[AlchemyProvider] Failed to parse cookie state, resetting.', e);
      return undefined;
    }
  }, [cookie]);

  return (
    <AlchemyAccountProvider config={config} queryClient={queryClient} initialState={initialState}>
      {children}
    </AlchemyAccountProvider>
  );
}
