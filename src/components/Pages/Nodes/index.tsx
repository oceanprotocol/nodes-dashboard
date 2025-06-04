import React from 'react'
import styles from './index.module.css'
import Table from '@/components/Table'
import HeroSection from '@/components/HeroSection/HeroSection'
import { TableTypeEnum } from '@/shared/enums/TableTypeEnum'
import { useNodesContext } from '@/context/NodesContext'
import { NodesDashboard } from '@/components/Dashboard'

const NodesPage: React.FC = () => {
  const {
    data,
    loading,
    currentPage,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize
  } = useNodesContext()

  return (
    <div className={styles.root}>
      <HeroSection title="Nodes" />
      <div className={styles.mainContainer}>
        <div className={styles.dashboardContainer}>
          <NodesDashboard />
        </div>
        <Table
          tableType={TableTypeEnum.NODES}
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
    </div>
  )
}

export default NodesPage
