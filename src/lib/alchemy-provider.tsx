'use client';

import { isAlchemyMigrationUser } from '@/lib/embedded-wallet';
import { alchemy, base, sepolia } from '@account-kit/infra';
import { createMigrationConfig, MigrationProvider } from '@privy-io/alchemy-migration';
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
        [
          { type: 'passkey' },
          { type: 'social', authProviderId: 'google', mode: 'redirect', redirectUrl: process.env.NEXT_PUBLIC_APP_URL! },
        ],
      ],
      addPasskeyOnSignup: true,
    },
  }
);

// createOnLogin and this plugin only apply to logins through Privy's modal. The headless login
// page creates the wallet itself, using the same rule (see needsEmbeddedWallet).
const walletCreationPlugin = createWalletCreationOnLoginPlugin({
  shouldCreateWallet: ({ user }: { user: User }) => !isAlchemyMigrationUser(user),
});

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // No 'wallet': native wallets run on their own stack (src/lib/use-injected-wallet.ts).
        loginMethods: ['email', 'google', 'passkey'],
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
