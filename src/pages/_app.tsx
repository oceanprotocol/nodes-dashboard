import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import type { AppProps } from 'next/app';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import RootLayout from '../components/Layout';
import { AdminProvider } from '../context/AdminProvider';
import { chains } from '../shared/utils/chains';
import {  DataProvider } from '@/context/DataContext';
import { MapProvider } from '../context/MapContext'

export default function App({ Component, pageProps }: AppProps) {
  const config = getDefaultConfig({
    appName: 'Ocean Node Dashboard',
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID
      ? process.env.NEXT_PUBLIC_WALLET_CONNECT_ID
      : 'da267f7e1897e2cf92a7710f92e8f660',
    chains,
    ssr: true,
  });

  const queryClient = new QueryClient();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AdminProvider>
            <DataProvider>
              <MapProvider>
                <RootLayout>
                  <Component {...pageProps} />
                </RootLayout>
              </MapProvider>
            </DataProvider>
          </AdminProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
