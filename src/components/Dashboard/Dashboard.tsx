import React from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useDataContext } from '@/context/DataContext'
import { useMapContext } from '../../context/MapContext'
import { CircularProgress, Alert, Box } from '@mui/material'

const formatNumber = (num: number | string | undefined): string => {
  if (num === undefined) return '0'
  const numStr = typeof num === 'string' ? num : num.toString()
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const Dashboard = () => {
  const { data, loading, error, totalNodes, totalEligibleNodes } = useDataContext()
  const { totalCountries } = useMapContext()

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
      <Card
        title="Total Eligible Nodes"
        bigNumber={formatNumber(totalEligibleNodes)}
        // additionalInfo={
        //   <div className={styles.nodeStats}>
        //     <div className={styles.greenBox}>{eligibleNodes}</div>
        //     <div className={styles.lastYear}>
        //       Total Nodes <span>{totalNodes}</span>
        //     </div>
        //   </div>
        // }
      />
      <Card title="Total Countries" bigNumber={formatNumber(totalCountries)} />
      <Card
        title="Total Nodes"
        bigNumber={formatNumber(totalNodes)}
        // additionalInfo={
        //   <div className={styles.nodeStats}>
        //     <div className={styles.greenBox}>{totalNodes}</div>
        //     <div className={styles.lastYear}>
        //       Eligible Nodes <span>{eligibleNodes}</span>
        //     </div>
        //   </div>
        // }
      />
      <Card
        title="Total Rewards"
        additionalInfo={
          <div className={styles.rewardAmount}>
            <span className={styles.rewardNumber}>{formatNumber(24.356)}</span>
            <span className={styles.oceanText}>OCEAN</span>
          </div>
        }
      />
    </div>
  )
}

export default Dashboard
