'use client';

import { installPrivyAlchemyFetchLogger } from '@/lib/debug-fetch';
import { alchemy, base, sepolia } from '@account-kit/infra';
import { MigrationProvider, createMigrationConfig, useMigration } from '@privy-io/alchemy-migration';
import '@privy-io/alchemy-migration/styles.css';
import { createWalletCreationOnLoginPlugin, PrivyProvider, type User } from '@privy-io/react-auth';
import { useEffect } from 'react';

// TEMP DIAGNOSTIC: install the Privy/Alchemy network logger as early as possible (module load,
// client only) so we capture the auth + migration API traffic.
installPrivyAlchemyFetchLogger();

const chain = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? base : sepolia;

const migrationConfig = createMigrationConfig(
  {
    transport: alchemy({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY! }),
    chain,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
  } as any,
  {
    illustrationStyle: 'outline',
    auth: {
      sections: [
        [{ type: 'email' }],
        [{ type: 'passkey' }, { type: 'social', authProviderId: 'google', mode: 'redirect', redirectUrl: process.env.NEXT_PUBLIC_APP_URL! }],
        [{ type: 'external_wallets' }],
      ],
      addPasskeyOnSignup: true,
    },
  }
);

// createOnLogin handles wallet creation for the standard redirect OAuth path (where the plugin
// callback is not invoked). The plugin runs for flows where privy calls it (email, passkey) and
// suppresses wallet creation for Alchemy migration users (alchemy_org_id present).
const walletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: ({ user }: { user: User }) =>
    user.customMetadata?.['alchemy_org_id'] === undefined,
});

// TEMP DIAGNOSTIC: trace the migration state machine (step / error / needsMigration /
// alchemyData) so we can see why the flow re-runs the import or hangs.
function MigrationDebugLogger() {
  const m = useMigration();
  useEffect(() => {
    console.log('[migration-state]', {
      step: m.step,
      error: m.error,
      isLoading: m.isLoading,
      isOpen: m.isOpen,
      hasDismissed: m.hasDismissed,
      hasCompleted: m.hasCompleted,
      needsMigration: m.needsMigration,
      isOAuthReturn: m.isOAuthReturn,
      oauthReturnProvider: m.oauthReturnProvider,
      alchemyData: m.alchemyData,
    });
  }, [
    m.step,
    m.error,
    m.isLoading,
    m.isOpen,
    m.hasDismissed,
    m.hasCompleted,
    m.needsMigration,
    m.isOAuthReturn,
    m.oauthReturnProvider,
    m.alchemyData,
  ]);
  return null;
}

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'passkey', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        plugins: [walletCreationPlugin],
      }}
    >
      <MigrationProvider
        alchemyConfig={migrationConfig}
        privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      >
        <MigrationDebugLogger />
        {children}
      </MigrationProvider>
    </PrivyProvider>
  );
}
