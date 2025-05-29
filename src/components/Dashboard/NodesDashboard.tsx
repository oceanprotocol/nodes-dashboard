import React, { useEffect, useState, useMemo } from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useNodesContext } from '../../context/NodesContext'
import { Alert, Box } from '@mui/material'

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

const formatEligibleNodesChartData = (transformedRewardsHistory: any[] | undefined) => {
  if (
    !transformedRewardsHistory ||
    !Array.isArray(transformedRewardsHistory) ||
    transformedRewardsHistory.length === 0
  ) {
    console.warn(
      '[formatEligibleNodesChartData] Input data (transformedRewardsHistory) is invalid or empty.'
    )
    return []
  }
  try {
    const chartData = transformedRewardsHistory
      .map((item) => {
        const dateStr = item?.date ? String(item.date) : null
        const eligibleNodes = item?.background?.value
        const totalAmountForRound =
          typeof item?.weeklyAmount === 'number' ? item.weeklyAmount : 0

        if (
          dateStr === null ||
          typeof eligibleNodes !== 'number' ||
          isNaN(eligibleNodes) ||
          eligibleNodes < 0
        ) {
          console.warn(
            '[formatEligibleNodesChartData] Skipping invalid item from transformedRewardsHistory:',
            item
          )
          return null
        }

        const numericDate = parseInt(dateStr, 10)
        if (isNaN(numericDate)) {
          console.warn(
            '[formatEligibleNodesChartData] Skipping item with non-numeric date from transformedRewardsHistory:',
            item
          )
          return null
        }

        return {
          dateForSort: numericDate,
          label: `Round ${dateStr}`,
          value: eligibleNodes,
          totalAmount: totalAmountForRound
        }
      })
      .filter((item) => item !== null)
      .sort((a, b) => a!.dateForSort - b!.dateForSort)
      .map((item) => ({
        xAxisValue: item!.dateForSort,
        date: item!.label,
        background: { value: item!.totalAmount },
        foreground: { value: item!.value },
        totalAmount: item!.totalAmount
      }))

    return chartData
  } catch (error) {
    console.error('[formatEligibleNodesChartData] Error formatting data:', error)
    return []
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
    rewardsHistory,
    averageIncentiveData,
    fetchRewardsHistory,
    totalUptime
  } = useNodesContext()

  const combinedLoading =
    loadingTotalNodes ||
    loadingTotalEligible ||
    loadingTotalRewards ||
    loadingRewardsHistory

  const [overallDashboardLoading, setOverallDashboardLoading] = useState(combinedLoading)

  const averageTrendInfo = useMemo(
    () => calculateTrendInfo(averageIncentiveData),
    [averageIncentiveData]
  )

  const periodAverage = useMemo(() => {
    return calculatePeriodAverage(averageIncentiveData)
  }, [averageIncentiveData])

  const eligibleNodesChartData = useMemo(
    () => formatEligibleNodesChartData(rewardsHistory),
    [rewardsHistory]
  )

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

  useEffect(() => {
    fetchRewardsHistory()
  }, [fetchRewardsHistory])

  useEffect(() => {
    setOverallDashboardLoading(combinedLoading)
  }, [combinedLoading])

  const isLoading = overallDashboardLoading

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
        title="Eligible Nodes per Round"
        chartType="bar"
        chartData={eligibleNodesChartData}
        isLoading={isLoading}
      />
      <Card
        title="Rewards History"
        chartType="line"
        chartData={rewardsHistory}
        isLoading={isLoading}
      />
    </div>
  )
}

export default NodesDashboard
