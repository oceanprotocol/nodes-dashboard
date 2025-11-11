import RootLayout from '@/components/Layout';
import { AppKit } from '@/context/app-kit';
import { NodesProvider } from '@/context/nodes-context';
import { StatsProvider } from '@/context/stats-context';
import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import type { AppProps } from 'next/app';
import { Inter, Orbitron } from 'next/font/google';
import { useEffect, useRef } from 'react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  weight: ['400', '600', '700'],
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  const queryClientRef = useRef<QueryClient>();
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(inter.variable, orbitron.variable);
  }, []);

  return (
    <main className={cx(inter.variable, orbitron.variable)}>
      <QueryClientProvider client={queryClientRef.current}>
        <StatsProvider>
          <NodesProvider>
            <AppKit>
              <RootLayout>
                <Component {...pageProps} />
              </RootLayout>
            </AppKit>
          </NodesProvider>
        </StatsProvider>
      </QueryClientProvider>
    </main>
  );
}
