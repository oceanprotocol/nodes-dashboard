import styles from './HeroSection.module.css'

interface HeroSectionProps {
  title: string
  description?: string
  children?: React.ReactNode
}

const HeroSection: React.FC<HeroSectionProps> = ({ title, description, children }) => {
  return (
    <div className={styles.root}>
      <div className={styles.heroSection}>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  )
}

export default HeroSection
