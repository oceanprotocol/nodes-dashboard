'use client'
import Image from 'next/image'
import logo from '../../assets/logo.svg'
import styles from './style.module.css'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

const NavBar = () => {
  return (
    <div className={styles.navbarParent}>
      <div className={styles.logoWrapper}>
        <Link href="/">
          <Image src={logo} alt="Ocean Node Logo" priority />
        </Link>
      </div>
      <div className={styles.NavbarLinks}>
        <div className={styles.connectButtonWrapper}>
          <ConnectButton />
        </div>
      </div>
    </div>
  )
}

export default NavBar
