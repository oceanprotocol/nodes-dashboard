'use client';

import { alchemy, base, sepolia } from '@account-kit/infra';
import { AlchemyProvider as PrivyAlchemyProvider } from '@account-kit/privy-integration';
import { MigrationProvider, createMigrationConfig } from '@privy-io/alchemy-migration';
import { PrivyProvider } from '@privy-io/react-auth';

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
        [{ type: 'passkey' }, { type: 'social', authProviderId: 'google', mode: 'popup' }],
        [{ type: 'external_wallets' }],
      ],
      addPasskeyOnSignup: true,
    },
  }
);

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <MigrationProvider
      alchemyConfig={migrationConfig}
      privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
    >
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          loginMethods: ['email', 'google', 'passkey', 'wallet'],
          embeddedWallets: {
            ethereum: { createOnLogin: 'users-without-wallets' },
          },
        }}
      >
        <PrivyAlchemyProvider
          apiKey={process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!}
          policyId={process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID}
        >
          {children}
        </PrivyAlchemyProvider>
      </PrivyProvider>
    </MigrationProvider>
  );
}
