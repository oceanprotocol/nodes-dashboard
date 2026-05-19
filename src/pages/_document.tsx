import { Head, Html, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17691004915" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-17691004915');
            `,
          }}
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
        <meta
          name="description"
          content="Run pay-per-use compute jobs on Ocean Network with competitive GPU pricing, editor native workflows, escrow-protected payments, and local outputs."
        />

        {/* Open Graph */}
        <meta property="og:site_name" content="Ocean Network - Decentralized P2P Compute Network" />
        <meta property="og:title" content="Ocean Network - Decentralized P2P Compute Network" />
        <meta
          property="og:description"
          content="Run pay-per-use compute jobs on Ocean Network with competitive GPU pricing, editor native workflows, escrow-protected payments, and local outputs."
        />
        <meta property="og:url" content="https://dashboard.oncompute.ai" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://dashboard.oncompute.ai/preview.jpg" />
        <meta property="og:image:alt" content="Ocean Network" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ocean Network - Decentralized P2P Compute Network" />
        <meta
          name="twitter:description"
          content="Run pay-per-use compute jobs on Ocean Network with competitive GPU pricing, editor native workflows, escrow-protected payments, and local outputs."
        />
        <meta name="twitter:image" content="https://dashboard.oncompute.ai/preview.jpg" />
        <meta name="twitter:image:alt" content="Ocean Network" />
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
