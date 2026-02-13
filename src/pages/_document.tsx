import { Head, Html, Main, NextScript } from 'next/document';

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
      </body>
    </Html>
  );
}
