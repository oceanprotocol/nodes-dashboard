import Dashboard from '../Dashboard/Dashboard'
import styles from './HeroSection.module.css'

interface HeroSectionProps {
  title: string
  description?: string
  dashboard?: boolean
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  description,
  dashboard = true
}) => {
  return (
    <div className={styles.root}>
      <div className={styles.heroSection}>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {dashboard && <Dashboard />}
    </div>
  )
}

export default HeroSection
