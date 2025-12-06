import Head from 'next/head';
import HomePage from '@/components/homepage/homepage';

export default function Home() {
  return (
    <>
      <Head>
        <title>Ocean Network — Global Compute Power</title>
      </Head>
      <HomePage />
    </>
  );
}
