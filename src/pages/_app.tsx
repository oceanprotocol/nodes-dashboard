import RootLayout from '@/components/Layout';
import { NodesProvider } from '@/context/nodes-context';
import { ProfileProvider } from '@/context/profile-context';
import { RunJobProvider } from '@/context/run-job-context';
import { RunJobEnvsProvider } from '@/context/run-job-envs-context';
import { StatsProvider } from '@/context/stats-context';
import { UnbanRequestsProvider } from '@/context/unban-requests-context';
import { P2PProvider } from '@/contexts/P2PContext';
import { AlchemyProvider } from '@/lib/alchemy-provider';
import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import type { AppProps } from 'next/app';
import { Inter, Orbitron } from 'next/font/google';
import { useEffect, useRef } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
        <AlchemyProvider>
          <NodesProvider>
            <UnbanRequestsProvider>
              <ProfileProvider>
                <StatsProvider>
                  <P2PProvider>
                    <RunJobEnvsProvider>
                      <RunJobProvider>
                        <RootLayout>
                          <Component {...pageProps} />
                        </RootLayout>
                      </RunJobProvider>
                    </RunJobEnvsProvider>
                  </P2PProvider>
                </StatsProvider>
              </ProfileProvider>
            </UnbanRequestsProvider>
          </NodesProvider>
        </AlchemyProvider>
        <ToastContainer hideProgressBar theme="colored" />
      </QueryClientProvider>
    </main>
  );
}
