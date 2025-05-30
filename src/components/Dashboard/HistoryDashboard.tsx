import React from 'react'
import Card from '@/components/Card/Card'
import styles from './Dashboard.module.css'
import { useHistoryContext, HistoryContextType } from '@/context/HistoryContext'
import { Box, Alert, Typography } from '@mui/material'
import DashboardErrorDisplay from './DashboardErrorDisplay'
import { useHistoryDashboardData } from './useHistoryDashboardData'

const HistoryDashboard: React.FC = () => {
  const contextValues: HistoryContextType = useHistoryContext()

  const {
    uptimePercentage,
    uptimeValue,
    isLowPercentage,
    liveCurrentRoundStartedAgo,
    liveCurrentRoundStatus,
    liveCurrentRoundNumber,
    updatedLiveStatus,
    trackedPeriodLabel,
    formattedAverageReward,
    formattedAllTimeTotalDistribution,
    completedRounds,
    hasNoDataForPeriod,
    combinedError,
    dashboardOverallLoading
  } = useHistoryDashboardData(contextValues)

  const currentRoundCardLoading =
    contextValues.isInitialising || contextValues.loadingCurrentRound

  if (combinedError) {
    return (
      <DashboardErrorDisplay
        error={combinedError}
        message="Something went wrong loading history data"
      />
    )
  }

  if (hasNoDataForPeriod) {
    return (
      <Box
        sx={{
          mt: 4,
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Alert
          severity="info"
          sx={{
            width: '100%',
            maxWidth: '500px',
            mb: 2,
            '& .MuiAlert-icon': {
              color: '#8624e1'
            }
          }}
        >
          No history data available for this period and node
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Please try selecting a different time period from the dropdown above.
        </Typography>
      </Box>
    )
  }

  return (
    <div className={styles.dashboard}>
      <Card
        title="Current Round"
        bigNumber={liveCurrentRoundNumber}
        isLoading={currentRoundCardLoading}
        subText={
          <>
            Started {liveCurrentRoundStartedAgo} ago
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: liveCurrentRoundStatus.color }}
            ></span>
          </>
        }
      />
      <Card
        title="Uptime Percentage"
        isLoading={dashboardOverallLoading}
        additionalInfo={
          <>
            <div className={styles.uptimeContainer}>
              <div className={styles.progressBarContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${uptimeValue}%` }}
                ></div>
                <span
                  className={`${styles.percentageText} ${isLowPercentage ? styles.percentageTextLow : ''}`}
                >
                  {uptimePercentage}
                </span>
              </div>
            </div>
          </>
        }
        subText={
          <>
            <div className={styles.trackedLabel}>Tracked over:</div>
            <span>{trackedPeriodLabel}</span>
          </>
        }
      />
      <Card
        title="Total Completed Rounds"
        bigNumber={completedRounds}
        isLoading={dashboardOverallLoading}
        subText={
          <>
            <div className={styles.trackedLabel}>Updated Live</div>
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: updatedLiveStatus.color }}
            ></span>
          </>
        }
      />
      <Card
        title="Rewards History"
        isLoading={dashboardOverallLoading}
        tooltip="Estimated rewards based on average distribution per eligible node. Calculation: Total ROSE tokens distributed in the round divided by the number of eligible nodes."
        additionalInfo={
          <div className={styles.rewardsHistoryContent}>
            <div className={styles.rewardsLabels}>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Round</div>
                <div className={styles.rewardNumber}>
                  {contextValues.weekStats?.round ?? '-'}
                </div>
              </div>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Winnings</div>
                <div className={styles.rewardAmount}>{formattedAverageReward} ROSE</div>
              </div>
            </div>
          </div>
        }
        subText={
          <>
            <div>Total:</div>
            <span>{formattedAllTimeTotalDistribution} ROSE</span>
          </>
        }
      />
    </div>
  )
}

export default HistoryDashboard
