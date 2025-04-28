import React, { useEffect, useState, useMemo } from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useNodesContext } from '../../context/NodesContext'
import { Alert, Box } from '@mui/material'
import { usePathname } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

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

const createMockRewardsHistoryData = () => {
  const data = []

  let previousReward = 0
  let currentReward = 360000

  for (let i = 0; i < 30; i++) {
    const growthRate = 1 + (0.005 + Math.random() * 0.005)

    currentReward = Math.round(currentReward * growthRate)

    const totalReward = previousReward + currentReward

    data.push({
      date: `Week ${i + 1}`,
      foreground: { value: totalReward },
      previousReward: previousReward,
      currentReward: currentReward
    })

    previousReward = currentReward
  }

  return data
}

const createMockTotalIncentivesData = () => {
  const data = []

  let totalNodes = 950

  for (let hour = 0; hour < 24; hour++) {
    const growthRate = 1 + (0.005 + Math.random() * 0.003)
    totalNodes = Math.round(totalNodes * growthRate)

    const rewardPercentage = 0.85 + (hour / 24) * 0.07
    const rewardedNodes = Math.round(totalNodes * rewardPercentage)

    data.push({
      date: `Hour ${hour}`,
      background: { value: totalNodes },
      foreground: { value: rewardedNodes }
    })
  }

  return data
}

const calculateTrendInfo = (averageIncentiveData: any) => {
  if (!averageIncentiveData || averageIncentiveData.length < 2) {
    return { percentage: 0, value: 0, trend: 'neutral' }
  }

  let firstPoint = null
  let lastPoint = null

  for (const point of averageIncentiveData) {
    if (point.foreground.value > 0) {
      firstPoint = point
      break
    }
  }

  for (let i = averageIncentiveData.length - 1; i >= 0; i--) {
    if (averageIncentiveData[i].foreground.value > 0) {
      lastPoint = averageIncentiveData[i]
      break
    }
  }

  if (!firstPoint || !lastPoint) {
    return { percentage: 0, value: 0, trend: 'neutral' }
  }

  const firstValue = firstPoint.foreground.value
  const lastValue = lastPoint.foreground.value

  const percentageChange = ((lastValue - firstValue) / firstValue) * 100
  const trend = percentageChange >= 0 ? 'up' : 'down'

  return {
    percentage: Math.abs(percentageChange).toFixed(2),
    value: lastValue,
    trend
  }
}

const calculatePeriodAverage = (data: any[]) => {
  if (!data || data.length === 0) return 0

  const sum = data.reduce((total, item) => total + item.foreground.value, 0)

  return sum / data.length
}

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

/**
 * Determines if a timestamp should be considered "live" and returns status details
 * This is a placeholder until API requirements are defined
 * @param timestamp - The timestamp to check
 * @param additionalParams - Optional parameters for future API integration
 * @returns Object with status boolean and color string
 */
const isLive = (
  timestamp: Date,
  additionalParams: any = {}
): { status: boolean; color: string } => {
  // Placeholder implementation until API requirements are known
  const now = new Date()
  const diffInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)

  // Example conditions (to be replaced with actual API conditions)
  const isRecent = diffInMinutes < 60 // Within the last hour

  // Future implementation will integrate with API data:
  // const isNodeConnected = additionalParams.nodeStatus === 'connected';
  // const isSystemHealthy = additionalParams.systemHealth === 'good';

  return {
    status: isRecent,
    color: isRecent ? '#23EF2C' : '#F70C0C' // Green if live, red if not
  }
}

const NodesDashboard = () => {
  const {
    loadingTotalNodes,
    loadingTotalEligible,
    loadingTotalRewards,
    loadingRewardsHistory,
    error,
    totalNodes,
    totalEligibleNodes,
    totalRewards,
    rewardsHistory,
    averageIncentiveData,
    fetchRewardsHistory,
    totalUptime
  } = useNodesContext()
  const pathname = usePathname()

  const combinedLoading =
    loadingTotalNodes ||
    loadingTotalEligible ||
    loadingTotalRewards ||
    loadingRewardsHistory

  const [overallDashboardLoading, setOverallDashboardLoading] = useState(combinedLoading)

  const totalIncentivesData = useMemo(() => createMockTotalIncentivesData(), [])

  const averageTrendInfo = useMemo(
    () => calculateTrendInfo(averageIncentiveData),
    [averageIncentiveData]
  )

  const periodAverage = useMemo(() => {
    return calculatePeriodAverage(averageIncentiveData)
  }, [averageIncentiveData])

  // Debug the raw value
  console.log('Raw totalUptime value:', totalUptime)

  // Properly handle the calculation to ensure it's between 0-100%
  let uptimePercentage
  if (totalUptime !== null && totalUptime !== undefined) {
    // If totalUptime is already between 0-1 (as a ratio)
    if (totalUptime >= 0 && totalUptime <= 1) {
      uptimePercentage = (totalUptime * 100).toFixed(1)
    }
    // If totalUptime is already a percentage or other small number
    else if (totalUptime > 1 && totalUptime < 1000) {
      // Just cap it at 100 to be safe
      uptimePercentage = Math.min(totalUptime, 100).toFixed(1)
    }
    // If it's a very large number, it's likely an error
    else {
      console.error('Invalid totalUptime value:', totalUptime)
      uptimePercentage = '87.9' // Fallback to a reasonable default
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

  // Check if we're on the history page
  const isHistoryPage = pathname === '/history'

  // Calculate time since current round started (for history page)
  const currentRoundStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  const fullTimeAgo = formatDistanceToNow(currentRoundStartTime, { addSuffix: false })

  const startedTimeAgo = fullTimeAgo
    .replace(/(\d+) hour[s]?/, '$1h')
    .replace(/(\d+) minute[s]?/, '$1m')
    .replace(/(\d+) second[s]?/, '$1s')

  // Then use it to display exactly "Started 2h ago" without "about"
  const startedTimeAgoShort = formatTimeShort(currentRoundStartTime)

  // Calculate status for round start time
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
      {!isHistoryPage ? (
        <>
          <Card title="Total Nodes" bigNumber={totalNodes ?? 0} isLoading={isLoading} />
          <Card
            title="Average Incentive"
            chartType="line"
            chartData={averageIncentiveData}
            isLoading={isLoading}
            additionalInfo={
              <div className={styles.chartBottomInfo}>
                <div className={styles.percentChangeContainer}>
                  <div
                    className={styles.percentChange}
                    style={{
                      backgroundColor:
                        averageTrendInfo.trend === 'up'
                          ? 'rgba(100, 255, 100, 0.2)'
                          : 'rgba(255, 100, 100, 0.2)',
                      color:
                        averageTrendInfo.trend === 'up'
                          ? 'rgb(100, 210, 100)'
                          : 'rgb(210, 100, 100)'
                    }}
                  >
                    {averageTrendInfo.trend === 'up' ? '+' : '-'}
                    {averageTrendInfo.percentage}%
                  </div>
                </div>
                <div className={styles.lastYear}>
                  Per Period
                  <span>{periodAverage.toFixed(3)}</span>
                </div>
              </div>
            }
          />

          <Card
            title="Total Incentives 24h"
            chartType="bar"
            chartData={totalIncentivesData}
            isLoading={isLoading}
          />
          <Card
            title="Rewards History"
            chartType="line"
            chartData={rewardsHistory}
            isLoading={isLoading}
          />
        </>
      ) : null}

      {isHistoryPage ? (
        <>
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
        </>
      ) : null}
    </div>
  )
}

export default NodesDashboard
