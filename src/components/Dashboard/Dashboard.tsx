import React from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useDataContext } from '@/context/DataContext'
import { useMapContext } from '../../context/MapContext'
import { CircularProgress } from '@mui/material'

const Dashboard = () => {
  const { data, loading, error, totalNodes, totalEligibleNodes } = useDataContext()
  const { totalCountries } = useMapContext()

  if (loading) return <CircularProgress />
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className={styles.dashboard}>
      <Card
        title="Total Eligible Nodes"
        bigNumber={totalEligibleNodes}
        // additionalInfo={
        //   <div className={styles.nodeStats}>
        //     <div className={styles.greenBox}>{eligibleNodes}</div>
        //     <div className={styles.lastYear}>
        //       Total Nodes <span>{totalNodes}</span>
        //     </div>
        //   </div>
        // }
      />
      <Card title="Total Countries" bigNumber={totalCountries} />
      <Card
        title="Total Nodes"
        bigNumber={totalNodes}
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
            <span className={styles.rewardNumber}>{24.356}</span>
            <span className={styles.oceanText}>OCEAN</span>
          </div>
        }
      />
    </div>
  )
}

export default Dashboard
