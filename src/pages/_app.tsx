import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import type { AppProps } from 'next/app';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import RootLayout from '../components/Layout';
import { AdminProvider } from '@/context/AdminProvider'
import { chains } from '@/shared/utils/chains'
import { MapProvider } from '@/context/MapContext'
import { NodesProvider } from '@/context/NodesContext'
import { CountriesProvider } from '@/context/CountriesContext'
import { HistoryProvider } from '@/context/HistoryContext'

export default function App({ Component, pageProps }: AppProps) {
  const config = getDefaultConfig({
    appName: 'Ocean Node Dashboard',
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID
      ? process.env.NEXT_PUBLIC_WALLET_CONNECT_ID
      : 'da267f7e1897e2cf92a7710f92e8f660',
    chains,
    ssr: true
  })

  const queryClient = new QueryClient()

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AdminProvider>
            <NodesProvider>
              <CountriesProvider>
                <MapProvider>
                  <HistoryProvider>
                    <RootLayout>
                      <Component {...pageProps} />
                    </RootLayout>
                  </HistoryProvider>
                </MapProvider>
              </CountriesProvider>
            </NodesProvider>
          </AdminProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
