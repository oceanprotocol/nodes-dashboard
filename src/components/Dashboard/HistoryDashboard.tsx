import React from 'react'
import Card from '@/components/Card/Card'
import styles from './Dashboard.module.css'
import { useHistoryContext } from '@/context/HistoryContext'
import { formatUptimePercentage } from '@/components/Table/utils'
import { Box, Alert, Typography } from '@mui/material'
import dayjs from 'dayjs'

const formatTimeShort = (timestampMillis: number): string => {
  if (!timestampMillis) return '-'
  const date = new Date(timestampMillis)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 0) return 'in the future'

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

const isLive = (timestampMillis: number): { status: boolean; color: string } => {
  if (!timestampMillis) return { status: false, color: '#F70C0C' }
  const now = new Date()
  const diffInMinutes = (now.getTime() - timestampMillis) / (1000 * 60)
  const isRecent = diffInMinutes < 15
  return {
    status: isRecent,
    color: isRecent ? '#23EF2C' : '#F70C0C'
  }
}

const getWeekLabel = (startTimestampMillis: number, dateRange?: any): string => {
  if (!startTimestampMillis) return 'Current Week'

  const now = dayjs()
  const startDate = dayjs(startTimestampMillis)

  if (startDate.isAfter(now)) {
    const endOfWeek = startDate.add(6, 'day')
    return `${startDate.format('MMM D')} - ${endOfWeek.format('MMM D')}`
  }

  if (dateRange?.startDate && dateRange?.endDate) {
    const diffDays = dateRange.endDate.diff(dateRange.startDate, 'day')

    if (diffDays >= 28 && diffDays <= 31) {
      return '30 days'
    }

    if (diffDays >= 6 && diffDays <= 8) {
      return '7 days'
    }

    if (diffDays > 0) {
      return `${diffDays} days`
    }
  }

  const startOfWeek = startDate.day(4)
  const endOfWeek = startOfWeek.add(6, 'day')
  return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D')}`
}

const HistoryDashboard: React.FC = () => {
  const {
    loading: loadingHistory,
    error: errorHistory,
    weekStats,
    loadingWeekStats,
    errorWeekStats,
    getRewardsForPeriod,
    loadingRewards,
    totalProgramDistribution,
    currentRoundStats,
    loadingCurrentRound,
    dateRange
  } = useHistoryContext()

  console.log('HistoryDashboard Context:', {
    loadingHistory,
    errorHistory,
    weekStats,
    loadingWeekStats,
    errorWeekStats,
    currentRoundStats,
    loadingCurrentRound
  })

  const isLoading = loadingHistory || loadingWeekStats || loadingRewards

  const error = errorHistory || errorWeekStats

  const hasNoDataForPeriod =
    !isLoading &&
    !error &&
    weekStats &&
    (weekStats.totalUptime === 0 ||
      weekStats.totalUptime === null ||
      weekStats.totalUptime === undefined)

  const uptimePercentage = weekStats?.totalUptime
    ? formatUptimePercentage(weekStats.totalUptime, null)
    : '0.00%'
  const uptimeValue = parseFloat(uptimePercentage) || 0
  const isLowPercentage = uptimeValue < 30

  const selectedPeriodRoundStartTime = weekStats?.timestamp || 0
  const selectedPeriodStartedTimeAgoShort = formatTimeShort(selectedPeriodRoundStartTime)
  const selectedPeriodRoundStartStatus = isLive(selectedPeriodRoundStartTime)

  const liveCurrentRoundTimestamp = currentRoundStats?.timestamp || 0
  const liveCurrentRoundStartedAgo = formatTimeShort(liveCurrentRoundTimestamp)
  const liveCurrentRoundStatus = isLive(liveCurrentRoundTimestamp)
  const liveCurrentRoundNumber = currentRoundStats?.round?.toString() ?? '-'

  const updatedLiveStatus = isLive(weekStats?.lastRun || 0)

  const trackedPeriodLabel = getWeekLabel(weekStats?.timestamp || 0, dateRange)

  const periodRewards = weekStats?.week ? getRewardsForPeriod(weekStats.week) : null

  const formattedAverageReward = periodRewards?.averageReward
    ? periodRewards.averageReward.toFixed(2)
    : '-'

  const formattedAllTimeTotalDistribution = totalProgramDistribution
    ? (totalProgramDistribution / 1000).toFixed(0) + 'K'
    : '-'

  console.log('HistoryDashboard Derived Values:', {
    isLoading,
    error,
    hasNoDataForPeriod,
    uptimePercentage,
    uptimeValue,
    isLowPercentage,
    currentRound: weekStats?.round,
    completedRounds: weekStats?.round ? Math.max(0, weekStats.round - 1) : undefined,
    startedTimeAgoShort: selectedPeriodStartedTimeAgoShort,
    roundStartStatus: selectedPeriodRoundStartStatus,
    updatedLiveStatus,
    trackedPeriodLabel,
    periodRewards,
    formattedAverageReward
  })

  if (error) {
    const errorMessage = error?.message || 'Something went wrong loading history data'
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
          Error loading dashboard data: {errorMessage}
        </Alert>
      </Box>
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
        isLoading={loadingCurrentRound}
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
        isLoading={isLoading}
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
        bigNumber={weekStats?.round ? Math.max(0, weekStats.round - 1) : '-'}
        isLoading={isLoading}
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
        isLoading={isLoading}
        tooltip="Estimated rewards based on average distribution per eligible node. Calculation: Total ROSE tokens distributed in the round divided by the number of eligible nodes."
        additionalInfo={
          <div className={styles.rewardsHistoryContent}>
            <div className={styles.rewardsLabels}>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Round</div>
                <div className={styles.rewardNumber}>{weekStats?.round ?? '-'}</div>
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
