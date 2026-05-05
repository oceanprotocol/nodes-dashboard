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

const walletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: ({ user }: { user: User }) =>
    user.customMetadata?.['alchemy_org_id'] === undefined,
});

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'passkey', 'wallet'],
        plugins: [walletCreationPlugin],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
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
