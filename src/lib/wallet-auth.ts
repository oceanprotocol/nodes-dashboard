import { classifyError } from '@/lib/analytics';
import { SignMessageFn } from '@/lib/use-ocean-account';
import { WALLET_AUTH_TTL_MS, WalletAuth, WalletAuthMessageBuilder } from '@/types/wallet-auth';

const EXPIRY_MARGIN_MS = 60 * 1000;
const CLOCK_RESYNC_THRESHOLD_MS = 60 * 1000;

type CachedAuth = WalletAuth & { address: string; clockOffsetMs: number };
type PendingAuth = { address: string; promise: Promise<CachedAuth> };
type AuthRejection = { serverTime?: unknown };

/** A wallet signing failure, with a message that is safe to show the user. */
export class WalletAuthError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'WalletAuthError';
    this.code = code;
  }
}

const isSameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Signs once per wallet and reuses the signature until it expires. Create one per auth message. */
export const createWalletAuthSession = (getMessage: WalletAuthMessageBuilder) => {
  let cached: CachedAuth | null = null;
  let pending: PendingAuth | null = null;
  // Server time minus device time, learned from a rejected request, so a wrong device clock can't lock the user out.
  let clockOffsetMs = 0;

  const serverNow = () => Date.now() + clockOffsetMs;

  const isValidFor = (auth: CachedAuth | null, address: string): auth is CachedAuth =>
    !!auth && isSameAddress(auth.address, address) && auth.expiryTimestamp - EXPIRY_MARGIN_MS > serverNow();

  const sign = async (address: string, signMessage: SignMessageFn): Promise<CachedAuth> => {
    const signedOffsetMs = clockOffsetMs;
    const expiryTimestamp = Date.now() + signedOffsetMs + WALLET_AUTH_TTL_MS;
    try {
      const signature = await signMessage(getMessage(address, expiryTimestamp));
      return { address, clockOffsetMs: signedOffsetMs, expiryTimestamp, signature };
    } catch (error) {
      if (classifyError(error) === 'user_rejected') {
        throw new WalletAuthError('Sign the message in your wallet to continue.', 'ACTION_REJECTED');
      }
      console.error('Failed to sign wallet auth message', error);
      throw new WalletAuthError("We couldn't get a signature from your wallet. Please try again.");
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

  /**
   * Runs `send` with a signature for `address`. `getRejection` returns the response body when the
   * server refused the signature and `null` for any other error; a refusal caused by a wrong device
   * clock is retried once with a fresh signature.
   */
  const request = <T>(
    address: string,
    signMessage: SignMessageFn,
    send: (auth: WalletAuth) => Promise<T>,
    getRejection: (error: unknown) => AuthRejection | null
  ): Promise<T> => {
    const attempt = async (isRetry: boolean): Promise<T> => {
      const auth = await getAuth(address, signMessage);
      try {
        return await send({ expiryTimestamp: auth.expiryTimestamp, signature: auth.signature });
      } catch (error) {
        const rejection = getRejection(error);
        if (!rejection) {
          throw error;
        }
        if (cached === auth) {
          cached = null;
        }
        const offset =
          typeof rejection.serverTime === 'number' ? rejection.serverTime - Date.now() : auth.clockOffsetMs;
        if (isRetry || Math.abs(offset - auth.clockOffsetMs) < CLOCK_RESYNC_THRESHOLD_MS) {
          throw error;
        }
        clockOffsetMs = offset;
        return attempt(true);
      }
    };

    return attempt(false);
  };

  return { request };
};
