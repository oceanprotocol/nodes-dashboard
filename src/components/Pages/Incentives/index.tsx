import React from 'react'
import styles from './index.module.css'

// import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'

const IncentivesPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <HeroSection
        title="Incentives"
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      />
      {/* <Table /> */}
    </div>
  )
}

export default IncentivesPage
