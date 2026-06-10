'use client';

import { alchemy, base, sepolia } from '@account-kit/infra';
import { MigrationProvider, createMigrationConfig } from '@privy-io/alchemy-migration';
import '@privy-io/alchemy-migration/styles.css';
import { createWalletCreationOnLoginPlugin, PrivyProvider, type User } from '@privy-io/react-auth';

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

// The plugin is the sole controller of embedded-wallet creation (no createOnLogin alongside it).
// For users being migrated from Alchemy (alchemy_org_id present) it returns false so
// MigrationProvider can show the key-transfer modal instead of creating a new wallet address.
// For all other users it returns true (create normally).
const walletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: ({ user }: { user: User }) => {
    const hasAlchemyOrg = user.customMetadata?.['alchemy_org_id'] !== undefined;
    const shouldCreate = !hasAlchemyOrg;
    console.log('[walletCreationPlugin] shouldCreateWallet called', {
      userId: user.id,
      customMetadata: user.customMetadata,
      hasAlchemyOrg,
      shouldCreate,
    });
    return shouldCreate;
  },
});

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'passkey', 'wallet'],
        plugins: [walletCreationPlugin],
      }}
    >
      <MigrationProvider
        alchemyConfig={migrationConfig}
        privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      >
        {children}
      </MigrationProvider>
    </PrivyProvider>
  );
}
