import { Head, Html, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
        <meta
          name="description"
          content="Run jobs, earn rewards, Run nodes and power the decentralized compute network. Keep control of your data, jobs & infrastructure."
        />

        {/* Open Graph */}
        <meta property="og:site_name" content="Ocean Nodes Dashboard" />
        <meta property="og:title" content="Ocean Nodes Dashboard — Run Jobs. Run Nodes. Earn Rewards." />
        <meta
          property="og:description"
          content="Run jobs, run nodes, earn rewards, and power the decentralized compute network. Keep control of your data, jobs & infrastructure."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/logo.svg" />
        <meta property="og:image:alt" content="Ocean Nodes Dashboard logo" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ocean Nodes Dashboard — Run jobs. Run nodes. Earn Rewards." />
        <meta
          name="twitter:description"
          content="Run jobs, run nodes, earn rewards, and power the decentralized compute network. Keep control of your data, jobs & infrastructure."
        />
        <meta name="twitter:image" content="/logo.svg" />
        <meta name="twitter:image:alt" content="Ocean Nodes Dashboard logo" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <Script
          strategy="beforeInteractive"
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="6be0fc4f-9e9c-4dee-a06f-e5bb0584cfe6"
          data-blockingmode="auto"
          type="text/javascript"
        />
      </body>
    </Html>
  );
}
