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
        <title>Ocean Network</title>
        <meta name="description" content="Ocean network" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <Navigation />
        {children}
        <FooterSection />
      </div>
    </>
  );
}
