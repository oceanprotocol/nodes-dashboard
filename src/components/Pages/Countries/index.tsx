import React from 'react'
import styles from './index.module.css'

import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'

const CountriesPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <HeroSection
        title="Nodes per Countries"
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
        dashboard={false}
      />
      <Table tableType="countries" />
    </div>
  )
}

export default CountriesPage
