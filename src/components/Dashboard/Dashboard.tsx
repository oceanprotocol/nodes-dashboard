import React from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useDataContext } from '@/context/DataContext'
import { useMapContext } from '../../context/MapContext'
import { CircularProgress, Alert, Box } from '@mui/material'
import { usePathname } from 'next/navigation'

const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined) return '0'
  const numStr = typeof num === 'string' ? num : num.toString()
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatRewardsNumber = (num: number | string | undefined): string => {
  if (num === undefined) return '0'
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
  const { loading, error, totalNodes, totalEligibleNodes, totalRewards, rewardsHistory } =
    useDataContext()
  const { totalCountries, loading: mapLoading } = useMapContext()
  const pathname = usePathname()

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
        isLoading={loading}
      />

      <Card
        title="Total Nodes"
        bigNumber={formatNumber(totalNodes)}
        isLoading={loading}
      />

      {pathname === '/nodes' ? (
        <Card
          title="Rewards History"
          chartType="line"
          chartData={rewardsHistory}
          isLoading={loading || !rewardsHistory}
        />
      ) : (
        <Card
          title="Total Countries"
          bigNumber={formatNumber(totalCountries)}
          isLoading={loading}
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
        isLoading={loading}
      />
    </div>
  )
}

export default Dashboard
