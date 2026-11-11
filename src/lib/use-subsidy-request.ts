import { useOceanAccount } from '@/lib/use-ocean-account';
import { getSubsidyAuthMessage, SUBSIDY_AUTH_ERROR, SUBSIDY_AUTH_TTL_MS, SubsidyAuth } from '@/types/subsidy';
import axios from 'axios';
import { useCallback } from 'react';

const EXPIRY_MARGIN_MS = 60 * 1000;

type CachedAuth = SubsidyAuth & { address: string };

// Module-level so every subsidy step shares one signature and one wallet prompt.
let cached: CachedAuth | null = null;
let pending: Promise<CachedAuth> | null = null;

const isValidFor = (auth: CachedAuth | null, address: string): auth is CachedAuth =>
  !!auth &&
  auth.address.toLowerCase() === address.toLowerCase() &&
  auth.expiryTimestamp - EXPIRY_MARGIN_MS > Date.now();

/** Posts to a subsidy API route as the connected wallet, signing once and reusing the signature until it expires. */
export function useSubsidyRequest() {
  const { account, signMessage } = useOceanAccount();
  const address = account.address;

  return useCallback(
    async <T = unknown>(url: string, body: Record<string, unknown> = {}) => {
      if (!address) {
        throw new Error('Connect a wallet to continue.');
      }
      if (!isValidFor(cached, address)) {
        if (!pending) {
          pending = (async () => {
            const expiryTimestamp = Date.now() + SUBSIDY_AUTH_TTL_MS;
            const signature = await signMessage(getSubsidyAuthMessage(address, expiryTimestamp));
            cached = { address, expiryTimestamp, signature };
            return cached;
          })().finally(() => {
            pending = null;
          });
        }
        await pending;
      }
      if (!isValidFor(cached, address)) {
        throw new Error('Wallet changed while signing. Please try again.');
      }
      const { expiryTimestamp, signature } = cached;
      try {
        return await axios.post<T>(url, { ...body, expiryTimestamp, signature, walletAddress: address });
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data?.error === SUBSIDY_AUTH_ERROR) {
          cached = null;
        }
        throw error;
      }
    },
    [address, signMessage]
  );
}
