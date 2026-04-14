import DocsWidget from '@/components/docs/docs-widget';
import FooterSection from '@/components/homepage/footer-section';
import Navigation from '@/components/Navigation/navigation';
import Head from 'next/head';
import { ReactNode } from 'react';
import styles from './index.module.css';

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <Head>
        <title>Ocean Network - Decentralized P2P Compute Network</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <Navigation />
        {children}
        <FooterSection />
        <DocsWidget />
      </div>
    </>
  );
}
