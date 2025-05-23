import Head from 'next/head'
import Footer from '../Footer'
import { ReactNode } from 'react'
import styles from './index.module.css'
import AnimatedBackground from '../AnimatedConnections/AnimatedBackground'
import { useRouter } from 'next/router'
import NavBar from '../Navigation'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  const router = useRouter()
  const isHomePage = router.pathname === '/'

  return (
    <>
      <Head>
        <title>Ocean nodes</title>
        <meta name="description" content="Ocean nodes dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div className={styles.topBackground}>
          <AnimatedBackground />
        </div>
        <div
          className={`${styles.mainContainer} ${isHomePage ? styles.mainContainerHome : ''}`}
        >
          <NavBar />
          {children}
          <Footer />
        </div>
      </div>
    </>
  )
}
