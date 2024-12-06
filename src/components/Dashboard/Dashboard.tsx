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
    return (number / 1000000).toFixed(1) + 'M'
  }
  if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'K'
  }
  return number.toString()
}

const Dashboard = () => {
  const { loading, error, totalNodes, totalEligibleNodes, totalRewards, rewardsHistory } =
    useDataContext()
  const { totalCountries } = useMapContext()
  const pathname = usePathname()
  const isNodesPage = pathname === '/nodes'

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: '#e000cf' }} />
      </Box>
    )
  }

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
      <Card title="Total Eligible Nodes" bigNumber={formatNumber(totalEligibleNodes)} />
      <Card title="Total Countries" bigNumber={formatNumber(totalCountries)} />
      <Card title="Total Nodes" bigNumber={formatNumber(totalNodes)} />
      {isNodesPage ? (
        <Card title="Eligible Nodes History" chartType="bar" chartData={rewardsHistory} />
      ) : (
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
        />
      )}
    </div>
  )
}

export default Dashboard
