import Dashboard from '../Dashboard/Dashboard'
import NavBar from '../Navigation'
import styles from './HeroSection.module.css'

const HeroSection = () => {
  return (
    <div className={styles.root}>
      <NavBar />
      <div className={styles.heroSection}>
        <h1>Ocean Nodes at a Glance</h1>
        <p>
          Ocean Node is a decentralized network of nodes that provide <br /> a secure and
          reliable connection to the Ocean Protocol.
        </p>
      </div>
      <Dashboard />
    </div>
  )
}

export default HeroSection
