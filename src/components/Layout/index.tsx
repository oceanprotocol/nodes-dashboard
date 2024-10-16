import Head from 'next/head'
import NavBar from '../Navigation'
import Footer from '../Footer'
import { ReactNode } from 'react'
import HeroSection from '../HeroSection/HeroSection'
import styles from './index.module.css'

// import Table from '../components/Table'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <Head>
        <title>Ocean nodes</title>
        <meta name="description" content="Ocean nodes dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <>
          <HeroSection />
          {children}
          <Footer />
        </>
      </main>
    </>
  )
}
