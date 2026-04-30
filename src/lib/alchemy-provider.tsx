'use client';

import { AlchemyProvider as PrivyAlchemyProvider } from '@account-kit/privy-integration';
import { PrivyProvider } from '@privy-io/react-auth';

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'passkey'],
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
  );
}
