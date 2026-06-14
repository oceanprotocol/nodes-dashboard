import type { ConnectedWallet } from '@privy-io/react-auth';

// Privy's getEmbeddedConnectedWallet filters out imported wallets (`!w.imported`).
// Alchemy->Privy migrated users get an *imported* embedded wallet (the migration imports the
// Alchemy signer key into Privy), so we must match embedded wallets regardless of `imported`,
// otherwise migrated accounts resolve to null and appear logged out.
export const getEmbeddedWallet = (wallets: ConnectedWallet[]): ConnectedWallet | null =>
  wallets.find((w) => w.walletClientType === 'privy' && w.connectorType === 'embedded') ?? null;
