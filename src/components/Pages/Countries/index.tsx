import React from 'react'
import styles from './index.module.css'

import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'
import { TableTypeEnum } from '../../../shared/enums/TableTypeEnum'

const CountriesPage: React.FC = () => {
  return (
    <div className={styles.root}>
      <HeroSection title="Nodes per Countries" dashboard={false} />
      <Table tableType={TableTypeEnum.COUNTRIES} />
    </div>
  )
}

export default CountriesPage
