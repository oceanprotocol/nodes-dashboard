import { derivePasswordKey, passwordKeyMessage } from '@/lib/service-password';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useCallback } from 'react';

// Module-level: survives navigation, never persisted. Holds the promise so concurrent callers share one prompt.
const keys = new Map<string, Promise<CryptoKey>>();

function isUserRejection(error: unknown): boolean {
  const { code } = (error ?? {}) as { code?: unknown };
  return code === 4001 || code === 'ACTION_REJECTED';
}

// Resolves `null` when there is no signer or the user rejects.
export function useServicePasswordKey(): { getKey: () => Promise<CryptoKey | null> } {
  const { keySigner } = useOceanAccount();

  const getKey = useCallback(async (): Promise<CryptoKey | null> => {
    if (!keySigner) return null;
    const id = `${window.location.host}|${keySigner.address}`;
    let pending = keys.get(id);
    if (!pending) {
      pending = keySigner
        .signMessage(passwordKeyMessage(window.location.host, keySigner.address))
        .then(derivePasswordKey);
      keys.set(id, pending);
    }
    try {
      return await pending;
    } catch (error) {
      if (keys.get(id) === pending) keys.delete(id);
      if (!isUserRejection(error)) console.warn('Could not derive service password key:', error);
      return null;
    }
  }, [keySigner]);

  return { getKey };
}
