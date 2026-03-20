import RootLayout from '@/components/Layout';
import config from '@/config';
import { GrantProvider } from '@/context/grant-context';
import { NodesProvider } from '@/context/nodes-context';
import { ProfileProvider } from '@/context/profile-context';
import { RunJobProvider } from '@/context/run-job-context';
import { RunJobEnvsProvider } from '@/context/run-job-envs-context';
import { RunNodeProvider } from '@/context/run-node-context';
import { StatsProvider } from '@/context/stats-context';
import { UnbanRequestsProvider } from '@/context/unban-requests-context';
import { P2PProvider } from '@/contexts/P2PContext';
import { AlchemyProvider } from '@/lib/alchemy-provider';
import { OceanAccountProvider } from '@/lib/use-ocean-account';
import { PHProvider } from '@/lib/use-posthog';
import '@/styles/globals.css';
import { createTheme, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import App, { type AppContext, type AppProps } from 'next/app';
import dynamic from 'next/dynamic';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { useEffect, useRef } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MoonPayProvider = dynamic(() => import('@moonpay/moonpay-react').then((mod) => mod.MoonPayProvider), {
  ssr: false,
});

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

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(inter.variable, plusJakartaSans.variable);
  }, []);

  return (
    <main className={cx(inter.variable, plusJakartaSans.variable)}>
      <ThemeProvider theme={muiTheme}>
        <MoonPayProvider
          apiKey={process.env.NEXT_PUBLIC_MOONPAY_API_KEY!}
          debug={process.env.NEXT_PUBLIC_APP_ENV !== 'production'}
        >
          <GitBookProvider siteURL={config.links.docs}>
            <QueryClientProvider client={queryClientRef.current}>
              <AlchemyProvider cookie={cookie}>
                <OceanAccountProvider>
                  <GrantProvider>
                    <NodesProvider>
                      <UnbanRequestsProvider>
                        <ProfileProvider>
                          <StatsProvider>
                            <P2PProvider>
                              <RunJobEnvsProvider>
                                <RunJobProvider>
                                  <RunNodeProvider>
                                    <RootLayout>
                                      <PHProvider>
                                        <Component {...pageProps} />
                                      </PHProvider>
                                    </RootLayout>
                                  </RunNodeProvider>
                                </RunJobProvider>
                              </RunJobEnvsProvider>
                            </P2PProvider>
                          </StatsProvider>
                        </ProfileProvider>
                      </UnbanRequestsProvider>
                    </NodesProvider>
                  </GrantProvider>
                </OceanAccountProvider>
              </AlchemyProvider>
              <ToastContainer hideProgressBar theme="colored" />
            </QueryClientProvider>
          </GitBookProvider>
        </MoonPayProvider>
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
