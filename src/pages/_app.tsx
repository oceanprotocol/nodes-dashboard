import RootLayout from '@/components/Layout';
import { AppKit } from '@/context/app-kit';
import { NodesProvider } from '@/context/nodes-context';
import { OceanProvider } from '@/context/ocean-context';
import { ProfileProvider } from '@/context/profile-context';
import { RunJobProvider } from '@/context/run-job-context';
import { StatsProvider } from '@/context/stats-context';
import { UnbanRequestsProvider } from '@/context/unban-requests-context';
import { P2PProvider } from '@/context/P2PContext.api';
import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import type { AppProps } from 'next/app';
import { Inter, Orbitron } from 'next/font/google';
import { useEffect, useRef } from 'react';

if (typeof window !== 'undefined' && !Promise.withResolvers) {
  window.Promise.withResolvers = function <T>() {
    let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
    let reject: ((reason?: any) => void) | undefined;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { resolve: resolve!, reject: reject!, promise };
  };
}

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
        <OceanProvider>
          <NodesProvider>
            <UnbanRequestsProvider>
              <ProfileProvider>
                <StatsProvider>
                  <AppKit>
                    <P2PProvider>
                      <RunJobProvider>
                        <RootLayout>
                          <Component {...pageProps} />
                        </RootLayout>
                      </RunJobProvider>
                    </P2PProvider>
                  </AppKit>
                </StatsProvider>
              </ProfileProvider>
            </UnbanRequestsProvider>
          </NodesProvider>
        </OceanProvider>
      </QueryClientProvider>
    </main>
  );
}
