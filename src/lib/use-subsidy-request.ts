import { classifyError } from '@/lib/analytics';
import { SignMessageFn, useOceanAccount } from '@/lib/use-ocean-account';
import { withTimeout } from '@/lib/with-timeout';
import { getSubsidyAuthMessage, SUBSIDY_AUTH_ERROR, SUBSIDY_AUTH_TTL_MS, SubsidyAuth } from '@/types/subsidy';
import axios from 'axios';
import { useCallback } from 'react';

const EXPIRY_MARGIN_MS = 60 * 1000;
const CLOCK_RESYNC_THRESHOLD_MS = 60 * 1000;
const DEFAULT_TIMEOUT_MS = 60 * 1000;

type CachedAuth = SubsidyAuth & { address: string };
type PendingAuth = { address: string; promise: Promise<CachedAuth> };

/** A failure before the API answered, with a message that is safe to show the user. */
export class SubsidyRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SubsidyRequestError';
    this.code = code;
  }
}

export const getSubsidyErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }
  if (error instanceof SubsidyRequestError) {
    return error.message;
  }
  return fallback;
};

// Module-level so every subsidy step shares one signature and one wallet prompt.
let cached: CachedAuth | null = null;
let pending: PendingAuth | null = null;
// Server time minus device time, learned from a rejected request, so a wrong device clock can't lock the user out.
let clockOffsetMs = 0;

const serverNow = () => Date.now() + clockOffsetMs;

const isSameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const isValidFor = (auth: CachedAuth | null, address: string): auth is CachedAuth =>
  !!auth && isSameAddress(auth.address, address) && auth.expiryTimestamp - EXPIRY_MARGIN_MS > serverNow();

const sign = async (address: string, signMessage: SignMessageFn): Promise<CachedAuth> => {
  const expiryTimestamp = serverNow() + SUBSIDY_AUTH_TTL_MS;
  try {
    const signature = await signMessage(getSubsidyAuthMessage(address, expiryTimestamp));
    return { address, expiryTimestamp, signature };
  } catch (error) {
    if (classifyError(error) === 'user_rejected') {
      throw new SubsidyRequestError('Sign the message in your wallet to continue.', 'ACTION_REJECTED');
    }
    console.error('Failed to sign subsidy request', error);
    throw new SubsidyRequestError("We couldn't get a signature from your wallet. Please try again.");
  }
};

const getAuth = (address: string, signMessage: SignMessageFn): Promise<CachedAuth> => {
  if (isValidFor(cached, address)) {
    return Promise.resolve(cached);
  }
  if (!pending || !isSameAddress(pending.address, address)) {
    const entry: PendingAuth = {
      address,
      promise: sign(address, signMessage)
        .then((auth) => {
          if (pending === entry) {
            cached = auth;
          }
          return auth;
        })
        .finally(() => {
          if (pending === entry) {
            pending = null;
          }
        }),
    };
    pending = entry;
  }
  return pending.promise;
};

/** Posts to a subsidy API route as the connected wallet, signing once and reusing the signature until it expires. */
export function useSubsidyRequest() {
  const { account, signMessage } = useOceanAccount();
  const address = account.address;

  return useCallback(
    async <T = unknown>(url: string, body: Record<string, unknown> = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
      if (!address) {
        throw new SubsidyRequestError('Connect a wallet to continue.');
      }

      const send = async (isRetry: boolean) => {
        const auth = await getAuth(address, signMessage);
        const { expiryTimestamp, signature } = auth;
        try {
          return await withTimeout(
            (signal) => axios.post<T>(url, { ...body, expiryTimestamp, signature, walletAddress: address }, { signal }),
            timeoutMs,
            'Subsidy request'
          );
        } catch (error) {
          if (!axios.isAxiosError(error) || axios.isCancel(error)) {
            throw new SubsidyRequestError('The request timed out. Refresh the page and try again.');
          }
          const data = error.response?.data;
          if (data?.error !== SUBSIDY_AUTH_ERROR) {
            throw error;
          }
          if (cached === auth) {
            cached = null;
          }
          const offset = typeof data.serverTime === 'number' ? data.serverTime - Date.now() : clockOffsetMs;
          if (isRetry || Math.abs(offset - clockOffsetMs) < CLOCK_RESYNC_THRESHOLD_MS) {
            throw error;
          }
          clockOffsetMs = offset;
          return send(true);
        }
      };

      return send(false);
    },
    [address, signMessage]
  );
}
