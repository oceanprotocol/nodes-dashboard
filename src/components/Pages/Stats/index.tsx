import React from 'react'
import styles from './index.module.css'
import HeroSection from '@/components/HeroSection/HeroSection'

const StatsPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <HeroSection
        title="Stats"
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit"
      />
    </div>
  )
}

export default StatsPage
