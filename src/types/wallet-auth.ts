export type WalletAuth = {
  expiryTimestamp: number;
  signature: string;
};

export type WalletAuthMessageBuilder = (walletAddress: string, expiryTimestamp: number) => string;

export const WALLET_AUTH_ERROR = 'invalid-signature';
export const WALLET_AUTH_TTL_MS = 30 * 60 * 1000;

/** Each flow needs its own `purpose`, so a signature for one can't be replayed against another. */
export const createWalletAuthMessage =
  (purpose: string): WalletAuthMessageBuilder =>
  (walletAddress, expiryTimestamp) =>
    [purpose, `Wallet: ${walletAddress.toLowerCase()}`, `Expires: ${new Date(expiryTimestamp).toISOString()}`].join(
      '\n'
    );
