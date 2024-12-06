import EmpowerSection from '../EmpowerSection/EmpowerSection'
import SocialMediaFooter from './SocialMediaFooter'
import styles from './style.module.css'
import { getLinks } from '@/config'

const Footer = () => {
  const currentYear = new Date().getFullYear()
  const links = getLinks()

  return (
    <div className={styles.footer}>
      <EmpowerSection />
      <SocialMediaFooter />
      <div className={styles.footerContainer}>
        <p>@ {currentYear}, Ocean Nodes</p>
        <div className={styles.footerLinks}>
          <a href={links.website} target="_blank" rel="noopener noreferrer">
            Website
          </a>
          <a href={links.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </div>
  )
}

export default Footer
