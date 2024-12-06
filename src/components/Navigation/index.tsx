'use client'
import Image from 'next/image'
import logo from '../../assets/logo.svg'
import styles from './style.module.css'
// import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { getRoutes } from '../../config'

const NavBar = () => {
  const routes = getRoutes()

  return (
    <div className={styles.navbarParent}>
      <div className={styles.logoWrapper}>
        <Link href="/">
          <Image src={logo} alt="Ocean Node Logo" width={145} />
        </Link>
      </div>
      <div className={styles.navLinks}>
        {Object.values(routes).map((route) => (
          <Link key={route.path} href={route.path} className={styles.navLink}>
            {route.name}
          </Link>
        ))}
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
