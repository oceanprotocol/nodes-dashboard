import { alchemy, mainnet, sepolia } from '@account-kit/infra';
import { cookieStorage, createConfig } from '@account-kit/react';
import { QueryClient } from '@tanstack/react-query';

export const config = createConfig(
  {
    transport: alchemy({
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
    }),
    chain: process.env.NODE_ENV === 'production' ? mainnet : sepolia,
    ssr: true,
    storage: cookieStorage,
    enablePopupOauth: true,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
  },
  {
    illustrationStyle: 'outline',
    auth: {
      sections: [
        [{ type: 'email' }],
        [{ type: 'passkey' }, { type: 'social', authProviderId: 'google', mode: 'popup' }],
      ],
      addPasskeyOnSignup: true,
    },
  }
);

export const queryClient = new QueryClient();
