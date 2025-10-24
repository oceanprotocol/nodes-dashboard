'use client';

import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';

const projectId = '555782ec07321ad166d432d993bfc8f3';

const metadata = {
  name: 'Ocean C2D - Config',
  description: 'Config your C2D compute job',
  url: 'https://compute1.oceanprotocol.com/',
  icons: ['https://oceanprotocol.com/static/ae84296f3b9ccb7054530d3af623f1fa/logo.svg'],
};

createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks: [sepolia],
  projectId,
  features: {
    analytics: false,
    connectMethodsOrder: ['wallet', 'email', 'social'],
    connectorTypeOrder: ['injected'],
    socials: ['google'],
  },

  featuredWalletIds: ['c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'],
  allWallets: 'HIDE',
  enableWalletGuide: false,
  themeMode: 'light',
  themeVariables: {
    '--w3m-border-radius-master': '2px',
  },
  defaultAccountTypes: { eip155: 'eoa' },
});

export function AppKit({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
