import type { ConnectedWallet, User } from '@privy-io/react-auth';

// Privy's getEmbeddedConnectedWallet only matches `connectorType === 'embedded' && !imported`.
// Alchemy->Privy migrated users get an *imported* embedded wallet (the migration imports the
// Alchemy signer key into Privy), and its connected wallet reports `connectorType:
// 'embedded_imported'` — so Privy's helper misses it and migrated accounts appear logged out.
// Match both connector types so freshly-created and migrated (imported) embedded wallets resolve.
const EMBEDDED_CONNECTOR_TYPES = ['embedded', 'embedded_imported'];

/** Alchemy migration users get their old wallet imported instead of a new one. */
export const isAlchemyMigrationUser = (user: User) => user.customMetadata?.['alchemy_org_id'] !== undefined;

/** Mirrors `createOnLogin: 'users-without-wallets'` plus the migration exception. */
export const needsEmbeddedWallet = (user: User) =>
  !isAlchemyMigrationUser(user) &&
  !user.linkedAccounts.some((account) => account.type === 'wallet' && account.chainType === 'ethereum');

export const getEmbeddedWallet = (wallets: ConnectedWallet[]): ConnectedWallet | null =>
  wallets.find((w) => w.walletClientType === 'privy' && EMBEDDED_CONNECTOR_TYPES.includes(w.connectorType)) ?? null;
