'use client';

import { installPrivyAlchemyFetchLogger } from '@/lib/debug-fetch';
import { alchemy, base, sepolia } from '@account-kit/infra';
import { createMigrationConfig, MigrationProvider } from '@privy-io/alchemy-migration';
import '@privy-io/alchemy-migration/styles.css';
import { createWalletCreationOnLoginPlugin, PrivyProvider, type User } from '@privy-io/react-auth';

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
        [
          { type: 'passkey' },
          { type: 'social', authProviderId: 'google', mode: 'redirect', redirectUrl: process.env.NEXT_PUBLIC_APP_URL! },
        ],
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
  shouldCreateWallet: ({ user }: { user: User }) => user.customMetadata?.['alchemy_org_id'] === undefined,
});

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
      <MigrationProvider alchemyConfig={migrationConfig} privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}>
        {children}
      </MigrationProvider>
    </PrivyProvider>
  );
}
