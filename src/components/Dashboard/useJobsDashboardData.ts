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
          label: `${dateStr}`,
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
        background: { value: item.value },
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
  rewardsHistory: TransformedRewardItem[] | undefined
}

export interface NodesDashboardData {
  eligibleNodesChartData: ChartDataItem[]
  totalRewardsSumFromEligibleNodesChart: number
}

export const useJobsDashboardData = (
  props: NodesDashboardDataProps
): NodesDashboardData => {
  const { rewardsHistory } = props

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

  console.log('Rewards History:', rewardsHistory)
  console.log('Eligible Nodes Chart Data:', eligibleNodesChartData)

  return {
    eligibleNodesChartData,
    totalRewardsSumFromEligibleNodesChart
  }
}
