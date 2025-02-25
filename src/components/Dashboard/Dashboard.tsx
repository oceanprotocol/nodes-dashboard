import React, { useEffect, useState } from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useDataContext } from '@/context/DataContext'
import { useMapContext } from '../../context/MapContext'
import { Alert, Box } from '@mui/material'
import { usePathname } from 'next/navigation'

const formatNumber = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined) return '-'
  const numStr = typeof num === 'string' ? num : num.toString()
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatRewardsNumber = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined) return '-'
  const number = typeof num === 'string' ? parseFloat(num) : num

  if (number >= 1000000) {
    const millions = Math.floor((number / 1000000) * 100) / 100
    return millions.toFixed(2) + 'M'
  }
  if (number >= 1000) {
    const thousands = Math.floor((number / 1000) * 100) / 100
    return thousands.toFixed(2) + 'K'
  }
  const value = Math.floor(number * 100) / 100
  return value.toFixed(2)
}

const Dashboard = () => {
  const {
    loadingTotalNodes,
    loadingTotalEligible,
    loadingTotalRewards,
    loadingRewardsHistory,
    error,
    totalNodes,
    totalEligibleNodes,
    totalRewards,
    rewardsHistory
  } = useDataContext()
  const { totalCountries, loading: mapLoading } = useMapContext()
  const pathname = usePathname()

  const combinedLoading =
    loadingTotalNodes ||
    loadingTotalEligible ||
    loadingTotalRewards ||
    loadingRewardsHistory

  const [overallDashboardLoading, setOverallDashboardLoading] = useState(combinedLoading)

  useEffect(() => {
    if (combinedLoading) {
      setOverallDashboardLoading(true)
    } else {
      const timer = setTimeout(() => {
        setOverallDashboardLoading(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [combinedLoading])

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Alert
          severity="error"
          sx={{
            width: '100%',
            maxWidth: '500px',
            '& .MuiAlert-icon': {
              color: '#e000cf'
            }
          }}
        >
          Error loading dashboard data: {error?.message || 'Something went wrong'}
        </Alert>
      </Box>
    )
  }

  return (
    <div className={styles.dashboard}>
      <Card
        title="Total Eligible Nodes"
        bigNumber={formatNumber(totalEligibleNodes)}
        isLoading={overallDashboardLoading}
      />

      <Card
        title="Total Nodes"
        bigNumber={formatNumber(totalNodes)}
        isLoading={overallDashboardLoading}
      />

      {pathname === '/nodes' ? (
        <Card
          title="Rewards History"
          chartType="line"
          chartData={rewardsHistory}
          isLoading={overallDashboardLoading}
          dataLoading={overallDashboardLoading}
        />
      ) : (
        <Card
          title="Total Countries"
          bigNumber={formatNumber(totalCountries)}
          isLoading={overallDashboardLoading || mapLoading}
          dataLoading={mapLoading}
        />
      )}

      <Card
        title="Total Rewards"
        additionalInfo={
          <div className={styles.rewardAmount}>
            <span className={styles.rewardNumber}>
              {formatRewardsNumber(totalRewards)}
            </span>
            <span className={styles.oceanText}>ROSE</span>
          </div>
        }
        isLoading={overallDashboardLoading}
      />
    </div>
  )
}

export default Dashboard
