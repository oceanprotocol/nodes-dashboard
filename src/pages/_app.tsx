import RootLayout from '@/components/Layout';
import { getRouteTutorial } from '@/components/tutorial/registry';
import { TutorialProvider } from '@/components/tutorial/tutorial-context';
import TutorialOverlay from '@/components/tutorial/tutorial-overlay';
import config from '@/config';
import { GrantProvider } from '@/context/grant-context';
import { NodeTokensProvider } from '@/context/node-tokens';
import { NodesProvider } from '@/context/nodes-context';
import { ProfileProvider } from '@/context/profile-context';
import { RunJobProvider } from '@/context/run-job-context';
import { RunJobEnvsProvider } from '@/context/run-job-envs-context';
import { RunNodeProvider } from '@/context/run-node-context';
import { StatsProvider } from '@/context/stats-context';
import { UnbanRequestsProvider } from '@/context/unban-requests-context';
import { P2PProvider } from '@/contexts/P2PContext';
import { NodeAuthProvider } from '@/contexts/node-auth-context';
import { NodeStorageProvider } from '@/contexts/node-storage-context';
import { AlchemyProvider } from '@/lib/alchemy-provider';
import { OceanAccountProvider } from '@/lib/use-ocean-account';
import { PHProvider } from '@/lib/use-posthog';
import '@/styles/globals.css';
import { createTheme, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import App, { type AppContext, type AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const GitBookProvider = dynamic(() => import('@gitbook/embed/react').then((mod) => mod.GitBookProvider), {
  ssr: false,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '600', '700'],
  display: 'swap',
});

const muiTheme = createTheme({
  palette: {
    primary: {
      main: '#d54335', // accent1
    },
    secondary: {
      main: '#b7fd79', // accent2
    },
  },
});

export default function DashboardApp({ Component, pageProps, cookie }: AppProps & { cookie?: string }) {
  const queryClientRef = useRef<QueryClient>();
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }
  const router = useRouter();
  const tutorialPage = getRouteTutorial(router.pathname)?.page;

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(inter.variable, plusJakartaSans.variable);
  }, []);

  return (
    <main className={cx(inter.variable, plusJakartaSans.variable)}>
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=AW-17691004915"
        strategy="afterInteractive"
        data-cookieconsent="marketing"
        type="text/plain"
      />
      <Script id="google-analytics" strategy="afterInteractive" data-cookieconsent="marketing" type="text/plain">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'AW-17691004915');
        `}
      </Script>
      <ThemeProvider theme={muiTheme}>
        <GitBookProvider siteURL={config.links.docs}>
          <QueryClientProvider client={queryClientRef.current}>
            <AlchemyProvider cookie={cookie}>
              <OceanAccountProvider>
                <GrantProvider>
                  <NodesProvider>
                    <NodeTokensProvider>
                      <UnbanRequestsProvider>
                        <ProfileProvider>
                          <StatsProvider>
                            <P2PProvider>
                              <NodeAuthProvider>
                                <NodeStorageProvider>
                                  <RunJobEnvsProvider>
                                    <RunJobProvider>
                                      <RunNodeProvider>
                                        <TutorialProvider>
                                          <RootLayout>
                                            <PHProvider>
                                              <Component {...pageProps} />
                                            </PHProvider>
                                          </RootLayout>
                                          {tutorialPage ? <TutorialOverlay currentPage={tutorialPage} /> : null}
                                        </TutorialProvider>
                                      </RunNodeProvider>
                                    </RunJobProvider>
                                  </RunJobEnvsProvider>
                                </NodeStorageProvider>
                              </NodeAuthProvider>
                            </P2PProvider>
                          </StatsProvider>
                        </ProfileProvider>
                      </UnbanRequestsProvider>
                    </NodeTokensProvider>
                  </NodesProvider>
                </GrantProvider>
              </OceanAccountProvider>
            </AlchemyProvider>
            <ToastContainer hideProgressBar theme="colored" />
          </QueryClientProvider>
        </GitBookProvider>
      </ThemeProvider>
    </main>
  );
}

DashboardApp.getInitialProps = async (context: AppContext) => {
  const appProps = await App.getInitialProps(context);
  const req = context.ctx.req;
  const cookie = req ? req.headers.cookie : undefined;

  return {
    ...appProps,
    cookie,
  };
};
