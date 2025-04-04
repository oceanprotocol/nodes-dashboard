import React, { useEffect, useState } from 'react'
import Card from '@/components/Card/Card'
import styles from './Dashboard.module.css'
import { useNodesContext } from '@/context/NodesContext'
import { Box, Alert } from '@mui/material'

const formatTimeShort = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  const hours = Math.floor(diffInSeconds / 3600)
  const minutes = Math.floor((diffInSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return `${diffInSeconds}s`
  }
}

const isLive = (
  timestamp: Date,
  additionalParams: any = {}
): { status: boolean; color: string } => {
  const now = new Date()
  const diffInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)
  const isRecent = diffInMinutes < 60
  return {
    status: isRecent,
    color: isRecent ? '#23EF2C' : '#F70C0C'
  }
}

const HistoryDashboard: React.FC = () => {
  const {
    loadingTotalNodes,
    loadingTotalEligible,
    loadingTotalRewards,
    loadingRewardsHistory,
    error,
    rewardsHistory,
    fetchRewardsHistory,
    totalUptime
  } = useNodesContext()

  const combinedLoading =
    loadingTotalNodes ||
    loadingTotalEligible ||
    loadingTotalRewards ||
    loadingRewardsHistory

  const [overallDashboardLoading, setOverallDashboardLoading] = useState(combinedLoading)

  let uptimePercentage
  if (totalUptime !== null && totalUptime !== undefined) {
    if (totalUptime >= 0 && totalUptime <= 1) {
      uptimePercentage = (totalUptime * 100).toFixed(1)
    } else if (totalUptime > 1 && totalUptime < 1000) {
      uptimePercentage = Math.min(totalUptime, 100).toFixed(1)
    } else {
      console.error('Invalid totalUptime value:', totalUptime)
      uptimePercentage = '87.9'
    }
  } else {
    uptimePercentage = '0.0'
  }

  const isLowPercentage = parseFloat(uptimePercentage) <= 15

  useEffect(() => {
    fetchRewardsHistory()
  }, [fetchRewardsHistory])

  useEffect(() => {
    setOverallDashboardLoading(combinedLoading)
  }, [combinedLoading])

  const isLoading = overallDashboardLoading

  const currentRoundStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const startedTimeAgoShort = formatTimeShort(currentRoundStartTime)

  const roundStatus = isLive(currentRoundStartTime)

  if (error) {
    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
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
        title="Current Round"
        bigNumber={rewardsHistory.length > 0 ? rewardsHistory.length : 0}
        isLoading={isLoading}
        subText={
          <>
            Started {startedTimeAgoShort} ago
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: roundStatus.color }}
            ></span>
          </>
        }
      />
      <Card
        title="Uptime Percentage"
        isLoading={isLoading}
        additionalInfo={
          <>
            <div className={styles.uptimeContainer}>
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${uptimePercentage}%` }}
                ></div>
                <span
                  className={`${styles.percentageText} ${isLowPercentage ? styles.percentageTextLow : ''}`}
                >
                  {uptimePercentage}%
                </span>
              </div>
            </div>
          </>
        }
        subText={
          <>
            <div className={styles.trackedLabel}>Tracked over:</div>
            <span>30 days</span>
          </>
        }
      />
      <Card
        title="Total Completed Rounds"
        bigNumber={Math.max(0, (rewardsHistory.length || 0) - 1)}
        isLoading={isLoading}
        subText={
          <>
            <div className={styles.trackedLabel}>Updated Live</div>
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: roundStatus.color }}
            ></span>
          </>
        }
      />
      <Card
        title="Rewards History"
        isLoading={isLoading}
        tooltip="Total ROSE tokens rewarded to nodes"
        additionalInfo={
          <div className={styles.rewardsHistoryContent}>
            <div className={styles.rewardsLabels}>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Round</div>
                <div className={styles.rewardNumber}>18</div>
              </div>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Winnings</div>
                <div className={styles.rewardAmount}>2K ROSE</div>
              </div>
            </div>
          </div>
        }
        subText={
          <>
            <div>Total:</div>
            <span>27.3K ROSE</span>
          </>
        }
      />
    </div>
  )
}

export default HistoryDashboard
