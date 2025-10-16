import React from 'react'
import styles from './index.module.css'
import Table from '@/components/Table'
import HeroSection from '@/components/HeroSection/HeroSection'
import { TableTypeEnum } from '@/shared/enums/TableTypeEnum'
import { useNodesContext } from '@/context/NodesContext'
import JobsDashboard from '@/components/Dashboard/JobsDashboard'

const LeaderboardPage: React.FC = () => {
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
      <HeroSection
        title="Leaderboard"
        description="Explore the most active nodes in the Ocean Network"
      />
      <JobsDashboard />
      <Table
        tableType={TableTypeEnum.NODES_LEADERBOARD}
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

export default LeaderboardPage
