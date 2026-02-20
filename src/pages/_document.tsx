import { Head, Html, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content="Keep control of your data, jobs & infrastructure on a decentralized compute network."
        />
        <meta property="og:title" content="Ocean Network — Global Compute Power" />
        <meta
          property="og:description"
          content="Keep control of your data, jobs & infrastructure on a decentralized compute network."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ocean Network — Global Compute Power" />
        <meta
          name="twitter:description"
          content="Keep control of your data, jobs & infrastructure on a decentralized compute network."
        />
        <meta name="twitter:image" content="/banner-video.jpg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon.ico" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <Script strategy="beforeInteractive" id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="6be0fc4f-9e9c-4dee-a06f-e5bb0584cfe6" data-blockingmode="auto" type="text/javascript"/>
      </body>
    </Html>
  );
}
