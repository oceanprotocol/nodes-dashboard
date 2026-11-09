import { useOceanAccount } from '@/lib/use-ocean-account';
import { useCallback, useSyncExternalStore } from 'react';

// Admin-only incentive-backend routes (node job/service history) take an `expiryTimestamp` signed
// by a node admin. One signature is reused for every such request until it expires, so paging
// through the history tables — and opening both of them — costs a single wallet prompt.
const SIGNATURE_TTL_MS = 60 * 60 * 1000;
// Re-sign a little early so a request never goes out with a signature that expires in flight.
const EXPIRY_MARGIN_MS = 60 * 1000;

export type AdminAuth = {
  address: string;
  expiryTimestamp: number;
  signature: string;
};

// Module-level so every table on the page shares the same signature.
let cached: AdminAuth | null = null;
let pending: Promise<AdminAuth> | null = null;
const listeners = new Set<() => void>();

const setCached = (auth: AdminAuth | null) => {
  cached = auth;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => cached;
const getServerSnapshot = () => null;

const isValidFor = (auth: AdminAuth | null, address: string | undefined): auth is AdminAuth =>
  !!auth &&
  !!address &&
  auth.address.toLowerCase() === address.toLowerCase() &&
  auth.expiryTimestamp - EXPIRY_MARGIN_MS > Date.now();

export function useAdminSignature() {
  const { account, signMessage } = useOceanAccount();
  const address = account.address;
  const auth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // A signature from another wallet (account switched) or an expired one is as good as none.
  const adminAuth = isValidFor(auth, address) ? auth : null;

  const requestAdminAuth = useCallback(async (): Promise<AdminAuth> => {
    if (!address) {
      throw new Error('Connect a wallet to load the history.');
    }
    if (isValidFor(cached, address)) {
      return cached;
    }
    if (!pending) {
      pending = (async () => {
        const expiryTimestamp = Date.now() + SIGNATURE_TTL_MS;
        const signature = await signMessage(expiryTimestamp.toString());
        const next = { address, expiryTimestamp, signature };
        setCached(next);
        return next;
      })().finally(() => {
        pending = null;
      });
    }
    return pending;
  }, [address, signMessage]);

  const clearAdminAuth = useCallback(() => setCached(null), []);

  return { adminAuth, clearAdminAuth, requestAdminAuth };
}
