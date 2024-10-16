'use client'
import Image from 'next/image'
import logo from '../../assets/logo.svg'
import styles from './style.module.css'
// import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

const NavBar = () => {
  return (
    <div className={styles.navbarParent}>
      <div className={styles.logoWrapper}>
        <Link href="/">
          <Image src={logo} alt="Ocean Node Logo" width={145} />
        </Link>
      </div>
      <div className={styles.navLinks}>
        <Link href="/" className={styles.navLink}>
          Home
        </Link>
        <Link href="/nodes" className={styles.navLink}>
          Nodes
        </Link>
        <Link href="/countries" className={styles.navLink}>
          Countries
        </Link>
        <Link href="/incentives" className={styles.navLink}>
          Incentives
        </Link>
      </div>
      {/* <div className={styles.NavbarLinks}>
        <div className={styles.connectButtonWrapper}>
          <ConnectButton />
        </div>
      </div> */}
    </div>
  )
}

export default NavBar
