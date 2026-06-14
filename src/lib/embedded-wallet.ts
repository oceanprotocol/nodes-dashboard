import type { ConnectedWallet } from '@privy-io/react-auth';

// Privy's getEmbeddedConnectedWallet only matches `connectorType === 'embedded' && !imported`.
// Alchemy->Privy migrated users get an *imported* embedded wallet (the migration imports the
// Alchemy signer key into Privy), and its connected wallet reports `connectorType:
// 'embedded_imported'` — so Privy's helper misses it and migrated accounts appear logged out.
// Match both connector types so freshly-created and migrated (imported) embedded wallets resolve.
const EMBEDDED_CONNECTOR_TYPES = ['embedded', 'embedded_imported'];

export const getEmbeddedWallet = (wallets: ConnectedWallet[]): ConnectedWallet | null =>
  wallets.find((w) => w.walletClientType === 'privy' && EMBEDDED_CONNECTOR_TYPES.includes(w.connectorType)) ?? null;
