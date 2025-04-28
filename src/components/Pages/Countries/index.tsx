import React from 'react'
import styles from './index.module.css'
import Table from '../../Table'
import HeroSection from '../../HeroSection/HeroSection'
import { TableTypeEnum } from '@/shared/enums/TableTypeEnum'
import { useCountriesContext } from '@/context/CountriesContext'

const CountriesPage: React.FC = () => {
  const {
    data,
    loading,
    currentPage,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize
  } = useCountriesContext()

  return (
    <div className={styles.root}>
      <HeroSection title="Countries" />
      <Table
        tableType={TableTypeEnum.COUNTRIES}
        data={data}
        loading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPaginationChange={(page, size) => {
          setCurrentPage(page)
          setPageSize(size)
        }}
      />
    </div>
  )
}

export default CountriesPage
