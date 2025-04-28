import React, { useEffect, useState } from 'react'
import Card from '@/components/Card/Card'
import styles from './Dashboard.module.css'
import { useHistoryContext } from '@/context/HistoryContext'
import { formatUptimePercentage } from '@/components/Table/utils'
import { Box, Alert } from '@mui/material'
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

const getWeekLabel = (startTimestampMillis: number): string => {
  if (!startTimestampMillis) return 'Current Week'
  const startDate = dayjs(startTimestampMillis)
  const startOfWeek = startDate.day(4)
  const endOfWeek = startOfWeek.add(7, 'day')
  return `${startOfWeek.format('MMM D')} - ${endOfWeek.format('MMM D')}`
}

const HistoryDashboard: React.FC = () => {
  const {
    loading: loadingHistory,
    error: errorHistory,
    weekStats,
    loadingWeekStats,
    errorWeekStats
  } = useHistoryContext()

  console.log('HistoryDashboard Context:', {
    loadingHistory,
    errorHistory,
    weekStats,
    loadingWeekStats,
    errorWeekStats
  })

  const isLoading = loadingHistory || loadingWeekStats

  const error = errorHistory || errorWeekStats

  const uptimePercentage = weekStats?.totalUptime
    ? formatUptimePercentage(weekStats.totalUptime, null)
    : '0.00%'
  const uptimeValue = parseFloat(uptimePercentage) || 0
  const isLowPercentage = uptimeValue <= 15

  const currentRoundStartTime = weekStats?.timestamp || 0
  const startedTimeAgoShort = formatTimeShort(currentRoundStartTime)
  const roundStartStatus = isLive(currentRoundStartTime)

  const updatedLiveStatus = isLive(weekStats?.lastRun || 0)

  const trackedPeriodLabel = getWeekLabel(weekStats?.timestamp || 0)

  // Log derived values before rendering
  console.log('HistoryDashboard Derived Values:', {
    isLoading,
    error,
    uptimePercentage,
    uptimeValue,
    isLowPercentage,
    currentRound: weekStats?.round,
    completedRounds: weekStats?.round ? Math.max(0, weekStats.round - 1) : undefined,
    startedTimeAgoShort,
    roundStartStatus,
    updatedLiveStatus,
    trackedPeriodLabel
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

  return (
    <div className={styles.dashboard}>
      <Card
        title="Current Round"
        bigNumber={weekStats?.round ?? '-'}
        isLoading={isLoading}
        subText={
          <>
            Started {startedTimeAgoShort} ago
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: roundStartStatus.color }}
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
        tooltip="Total ROSE tokens rewarded to nodes"
        additionalInfo={
          <div className={styles.rewardsHistoryContent}>
            <div className={styles.rewardsLabels}>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Round</div>
                <div className={styles.rewardNumber}>-</div>
              </div>
              <div className={styles.rewardsValues}>
                <div className={styles.grayBox}>Winnings</div>
                <div className={styles.rewardAmount}>- ROSE</div>
              </div>
            </div>
          </div>
        }
        subText={
          <>
            <div>Total:</div>
            <span>- ROSE</span>
          </>
        }
      />
    </div>
  )
}

export default HistoryDashboard
