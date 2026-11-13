import RootLayout from '@/components/Layout';
import config from '@/config';
import { InferenceProvider } from '@/context/inference-context';
import { NodeTokensProvider } from '@/context/node-tokens';
import { NodesProvider } from '@/context/nodes-context';
import { ProfileProvider } from '@/context/profile-context';
import { RunJobProvider } from '@/context/run-job-context';
import { RunJobEnvsProvider } from '@/context/run-job-envs-context';
import { RunNodeProvider } from '@/context/run-node-context';
import { ServicesStatsProvider } from '@/context/services-stats-context';
import { StatsProvider } from '@/context/stats-context';
import { SubsidyProvider } from '@/context/subsidy-context';
import { UnbanRequestsProvider } from '@/context/unban-requests-context';
import { P2PProvider } from '@/contexts/P2PContext';
import { NodeStorageProvider } from '@/contexts/node-storage-context';
import { AlchemyProvider } from '@/lib/alchemy-provider';
import { OceanAccountProvider } from '@/lib/use-ocean-account';
import { PHProvider } from '@/lib/use-posthog';
import { ThemeProvider as OceanThemeProvider } from '@/lib/use-theme';
import '@/styles/globals.css';
import '@/styles/privy-migration.css';
import { createTheme, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import cx from 'classnames';
import App, { type AppContext, type AppInitialProps, type AppProps } from 'next/app';
import dynamic from 'next/dynamic';
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

/* MUI renders its own surfaces (DataGrid, Select menus, Dialogs), so it needs the same light/dark
   switch the CSS tokens get, keyed off the same `data-theme` attribute.

   `defaultMode`/`defaultColorScheme` MUST stay 'light'. Declaring both colour schemes otherwise
   makes MUI default to 'system', where it attaches its own `prefers-color-scheme` listener and
   writes `data-theme` itself — fighting src/lib/use-theme.tsx, so the app follows the OS even with
   a theme pinned. */
const muiTheme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-theme' },
  defaultColorScheme: 'light',
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#d54335', // accent1
        },
        secondary: {
          main: '#b7fd79', // accent2
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#d54335', // accent1 — brand color, same in both themes
        },
        secondary: {
          main: '#b7fd79', // accent2
        },
        background: {
          default: '#0d0e10', // --background-primary
          paper: '#16181c', // --background-modal, opaque
        },
      },
    },
  },
});

/* The CSP nonce minted in src/proxy.ts. The two tags below load client-side, after hydration, so
   they get no nonce from the server render and must carry it themselves. */
type DashboardAppProps = AppProps & { nonce?: string };

export default function DashboardApp({ Component, pageProps, nonce }: DashboardAppProps) {
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
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=AW-17691004915"
        strategy="afterInteractive"
        data-cookieconsent="marketing"
        type="text/plain"
        nonce={nonce}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        data-cookieconsent="marketing"
        type="text/plain"
        nonce={nonce}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'AW-17691004915');
        `}
      </Script>
      <OceanThemeProvider>
        <ThemeProvider theme={muiTheme} defaultMode="light">
          <GitBookProvider siteURL={config.links.docs}>
            <QueryClientProvider client={queryClientRef.current}>
              <AlchemyProvider>
                <OceanAccountProvider>
                  <SubsidyProvider>
                    <NodesProvider>
                      <NodeTokensProvider>
                        <UnbanRequestsProvider>
                          <ProfileProvider>
                            <StatsProvider>
                              <ServicesStatsProvider>
                                <P2PProvider>
                                  <NodeStorageProvider>
                                    <RunJobEnvsProvider>
                                      <RunJobProvider>
                                        <RunNodeProvider>
                                          <InferenceProvider>
                                            <RootLayout>
                                              <PHProvider>
                                                <Component {...pageProps} />
                                              </PHProvider>
                                            </RootLayout>
                                          </InferenceProvider>
                                        </RunNodeProvider>
                                      </RunJobProvider>
                                    </RunJobEnvsProvider>
                                  </NodeStorageProvider>
                                </P2PProvider>
                              </ServicesStatsProvider>
                            </StatsProvider>
                          </ProfileProvider>
                        </UnbanRequestsProvider>
                      </NodeTokensProvider>
                    </NodesProvider>
                  </SubsidyProvider>
                </OceanAccountProvider>
              </AlchemyProvider>
              <ToastContainer hideProgressBar theme="colored" />
            </QueryClientProvider>
          </GitBookProvider>
        </ThemeProvider>
      </OceanThemeProvider>
    </main>
  );
}

DashboardApp.getInitialProps = async (context: AppContext): Promise<AppInitialProps & { nonce?: string }> => {
  const appProps = await App.getInitialProps(context);
  // Only set on the server render; a client-side navigation has no request, and the tags above are
  // already in the document by then.
  const nonce = context.ctx.req?.headers['x-nonce'];
  return { ...appProps, nonce: typeof nonce === 'string' ? nonce : undefined };
};
