import { useOceanAccount } from '@/lib/use-ocean-account';
import { createWalletAuthSession, WalletAuthError } from '@/lib/wallet-auth';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';
import { getSubsidyAuthMessage } from '@/types/subsidy';
import { WALLET_AUTH_ERROR } from '@/types/wallet-auth';
import axios from 'axios';
import { useCallback } from 'react';

const DEFAULT_TIMEOUT_MS = 60 * 1000;

/** A failure before the API answered, with a message that is safe to show the user. */
export class SubsidyRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubsidyRequestError';
  }
}

export const getSubsidyErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }
  if (error instanceof SubsidyRequestError || error instanceof WalletAuthError) {
    return error.message;
  }
  return fallback;
};

// Module-level so every subsidy step shares one signature and one wallet prompt.
const subsidyAuth = createWalletAuthSession(getSubsidyAuthMessage);

const getAuthRejection = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  const data = error.response?.data;
  return data?.error === WALLET_AUTH_ERROR ? data : null;
};

/** Posts to a subsidy API route as the connected wallet, signing once and reusing the signature until it expires. */
export function useSubsidyRequest() {
  const { account, signMessage } = useOceanAccount();
  const address = account.address;

  return useCallback(
    <T = unknown>(url: string, body: Record<string, unknown> = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
      if (!address) {
        return Promise.reject(new SubsidyRequestError('Connect a wallet to continue.'));
      }

      return subsidyAuth.request(
        address,
        signMessage,
        async ({ expiryTimestamp, signature }) => {
          try {
            return await withTimeout(
              (signal) =>
                axios.post<T>(url, { ...body, expiryTimestamp, signature, walletAddress: address }, { signal }),
              timeoutMs,
              'Subsidy request'
            );
          } catch (error) {
            if (error instanceof TimeoutError || axios.isCancel(error)) {
              throw new SubsidyRequestError('The request timed out. Refresh the page and try again.');
            }
            throw error;
          }
        },
        getAuthRejection
      );
    },
    [address, signMessage]
  );
}
