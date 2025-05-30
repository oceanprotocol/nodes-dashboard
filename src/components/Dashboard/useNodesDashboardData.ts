import { useMemo } from 'react'

interface TransformedRewardItem {
  date: string | number
  background?: { value: number }
  weeklyAmount?: number
}

interface ChartDataItem {
  xAxisValue: number
  date: string
  background: { value: number }
  foreground: { value: number }
  totalAmount: number
}

const calculateTrendInfo = (averageIncentiveData: any[] | undefined) => {
  if (!averageIncentiveData || averageIncentiveData.length < 2) {
    return { percentage: 0, value: 0, trend: 'neutral' }
  }
  let firstPoint = null
  let lastPoint = null
  for (const point of averageIncentiveData) {
    if (point?.foreground?.value > 0) {
      firstPoint = point
      break
    }
  }
  for (let i = averageIncentiveData.length - 1; i >= 0; i--) {
    if (averageIncentiveData[i]?.foreground?.value > 0) {
      lastPoint = averageIncentiveData[i]
      break
    }
  }
  if (!firstPoint || !lastPoint) {
    return { percentage: 0, value: 0, trend: 'neutral' }
  }
  const firstValue = firstPoint.foreground.value
  const lastValue = lastPoint.foreground.value
  if (firstValue === 0) return { percentage: 0, value: lastValue, trend: 'neutral' }
  const percentageChange = ((lastValue - firstValue) / firstValue) * 100
  const trend = percentageChange >= 0 ? 'up' : 'down'
  return {
    percentage: Math.abs(percentageChange).toFixed(2),
    value: lastValue,
    trend
  }
}

const calculatePeriodAverage = (data: any[] | undefined) => {
  if (!data || data.length === 0) return 0
  const sum = data.reduce((total, item) => total + (item?.foreground?.value || 0), 0)
  return sum / data.length
}

const formatEligibleNodesChartData = (
  transformedRewardsHistory: TransformedRewardItem[] | undefined
): ChartDataItem[] => {
  if (
    !transformedRewardsHistory ||
    !Array.isArray(transformedRewardsHistory) ||
    transformedRewardsHistory.length === 0
  ) {
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
          return null
        }
        const numericDate = parseInt(dateStr, 10)
        if (isNaN(numericDate)) {
          return null
        }
        return {
          dateForSort: numericDate,
          label: `Round ${dateStr}`,
          value: eligibleNodes,
          totalAmount: totalAmountForRound
        }
      })
      .filter(
        (
          item
        ): item is {
          dateForSort: number
          label: string
          value: number
          totalAmount: number
        } => item !== null
      )
      .sort((a, b) => a.dateForSort - b.dateForSort)
      .map((item) => ({
        xAxisValue: item.dateForSort,
        date: item.label,
        background: { value: item.totalAmount },
        foreground: { value: item.value },
        totalAmount: item.totalAmount
      }))
    return chartData
  } catch (error) {
    console.error('[formatEligibleNodesChartData] Error formatting data:', error)
    return []
  }
}

interface NodesDashboardDataProps {
  averageIncentiveData: any[] | undefined
  rewardsHistory: TransformedRewardItem[] | undefined
}

export interface NodesDashboardData {
  averageTrendInfo: { percentage: string | number; value: number; trend: string }
  periodAverage: number
  eligibleNodesChartData: ChartDataItem[]
  totalRewardsSumFromEligibleNodesChart: number
}

export const useNodesDashboardData = (
  props: NodesDashboardDataProps
): NodesDashboardData => {
  const { averageIncentiveData, rewardsHistory } = props

  const averageTrendInfo = useMemo(
    () => calculateTrendInfo(averageIncentiveData),
    [averageIncentiveData]
  )

  const periodAverage = useMemo(
    () => calculatePeriodAverage(averageIncentiveData),
    [averageIncentiveData]
  )

  const eligibleNodesChartData = useMemo(
    () => formatEligibleNodesChartData(rewardsHistory),
    [rewardsHistory]
  )

  const totalRewardsSumFromEligibleNodesChart = useMemo(() => {
    if (!eligibleNodesChartData || eligibleNodesChartData.length === 0) {
      return 0
    }
    return eligibleNodesChartData.reduce((sum, item) => sum + (item.totalAmount || 0), 0)
  }, [eligibleNodesChartData])

  return {
    averageTrendInfo,
    periodAverage,
    eligibleNodesChartData,
    totalRewardsSumFromEligibleNodesChart
  }
}
