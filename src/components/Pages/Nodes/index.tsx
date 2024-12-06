import React from 'react'
import styles from './index.module.css'

import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'

const NodesPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <HeroSection title="Explore All Nodes" />
      <Table />
    </div>
  )
}

export default NodesPage
