import { useMemo } from 'react'
import dayjs from 'dayjs'
import { formatUptimePercentage } from '@/components/Table/utils'
import { DateRange } from '@/components/PeriodSelect'
import { formatNumber } from '../../utils/formatters'
import { NodeData } from '@/shared/types/RowDataType'

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

const getWeekLabel = (startTimestampMillis: number, dateRange?: DateRange): string => {
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
  let startOfWeekCalc = startDate
  if (startDate.day() >= 4) {
    startOfWeekCalc = startDate.day(4)
  } else {
    startOfWeekCalc = startDate.subtract(1, 'week').day(4)
  }
  const endOfWeekCalc = startOfWeekCalc.add(6, 'day')
  return `${startOfWeekCalc.format('MMM D')} - ${endOfWeekCalc.format('MMM D')}`
}

interface HistoryDataContextValues {
  weekStats: any
  currentRoundStats: any
  dateRange: DateRange | null
  getRewardsForPeriod: (week: number) => any | null
  totalProgramDistribution: number | null
  loading: boolean
  error: Error | null
  isInitialising: boolean
  nodesData: NodeData | null
}

export interface HistoryDashboardData {
  periodDurationInSeconds: number | null
  uptimePercentage: string
  uptimeValue: number
  isLowPercentage: boolean
  selectedPeriodRoundStartTime: number
  selectedPeriodStartedTimeAgoShort: string
  selectedPeriodRoundStartStatus: { status: boolean; color: string }
  liveCurrentRoundTimestamp: number
  liveCurrentRoundStartedAgo: string
  liveCurrentRoundStatus: { status: boolean; color: string }
  liveCurrentRoundNumber: string
  updatedLiveStatus: { status: boolean; color: string }
  trackedPeriodLabel: string
  periodRewards: any | null
  formattedAverageReward: string
  formattedAllTimeTotalDistribution: string
  completedRounds: number | string
  currentRoundForCard: string | undefined
  hasNoDataForPeriod: boolean
  combinedError: Error | null
  dashboardOverallLoading: boolean
}

export const useHistoryDashboardData = (
  contextValues: HistoryDataContextValues
): HistoryDashboardData => {
  const {
    weekStats,
    currentRoundStats,
    dateRange,
    getRewardsForPeriod,
    totalProgramDistribution,
    loading,
    error,
    isInitialising,
    nodesData
  } = contextValues

  const periodDurationInSeconds = useMemo(() => {
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      const duration = dateRange.endDate.unix() - dateRange.startDate.unix()
      if (duration > 0) {
        return duration
      }
    }
    return null
  }, [dateRange])

  const uptimePercentage = useMemo(
    () =>
      weekStats?.totalUptime
        ? formatUptimePercentage(nodesData?.uptime ?? 0, weekStats.totalUptime)
        : '0.00%',
    [weekStats]
  )

  const uptimeValue = useMemo(() => parseFloat(uptimePercentage) || 0, [uptimePercentage])
  const isLowPercentage = useMemo(() => uptimeValue < 30, [uptimeValue])

  const selectedPeriodRoundStartTime = useMemo(
    () => weekStats?.timestamp || 0,
    [weekStats]
  )
  const selectedPeriodStartedTimeAgoShort = useMemo(
    () => formatTimeShort(selectedPeriodRoundStartTime),
    [selectedPeriodRoundStartTime]
  )
  const selectedPeriodRoundStartStatus = useMemo(
    () => isLive(selectedPeriodRoundStartTime),
    [selectedPeriodRoundStartTime]
  )

  const liveCurrentRoundTimestamp = useMemo(
    () => currentRoundStats?.timestamp || 0,
    [currentRoundStats]
  )
  const liveCurrentRoundStartedAgo = useMemo(
    () => formatTimeShort(liveCurrentRoundTimestamp),
    [liveCurrentRoundTimestamp]
  )
  const liveCurrentRoundStatus = useMemo(
    () => isLive(liveCurrentRoundTimestamp),
    [liveCurrentRoundTimestamp]
  )
  const liveCurrentRoundNumber = useMemo(
    () => currentRoundStats?.round?.toString() ?? '-',
    [currentRoundStats]
  )

  const updatedLiveStatus = useMemo(() => isLive(weekStats?.lastRun || 0), [weekStats])
  const trackedPeriodLabel = useMemo(
    () =>
      getWeekLabel(weekStats?.timestamp || 0, dateRange === null ? undefined : dateRange),
    [weekStats, dateRange]
  )

  const periodRewards = useMemo(
    () => (weekStats?.week ? getRewardsForPeriod(weekStats.week) : null),
    [weekStats, getRewardsForPeriod]
  )

  const formattedAverageReward = useMemo(
    () => (periodRewards?.averageReward ? periodRewards.averageReward.toFixed(2) : '-'),
    [periodRewards]
  )

  const formattedAllTimeTotalDistribution = useMemo(
    () => (totalProgramDistribution ? formatNumber(totalProgramDistribution) : '-'),
    [totalProgramDistribution]
  )

  const completedRounds = useMemo(
    () => (weekStats?.round ? Math.max(0, weekStats.round - 1) : '-'),
    [weekStats]
  )

  const currentRoundForCard = useMemo(() => weekStats?.round?.toString(), [weekStats])

  const dashboardOverallLoadingState = loading || isInitialising
  const combinedErrorState = error

  const hasNoDataForPeriod = useMemo(
    () =>
      !dashboardOverallLoadingState &&
      !combinedErrorState &&
      weekStats &&
      (weekStats.totalUptime === 0 ||
        weekStats.totalUptime === null ||
        weekStats.totalUptime === undefined),
    [dashboardOverallLoadingState, combinedErrorState, weekStats]
  )

  return {
    periodDurationInSeconds,
    uptimePercentage,
    uptimeValue,
    isLowPercentage,
    selectedPeriodRoundStartTime,
    selectedPeriodStartedTimeAgoShort,
    selectedPeriodRoundStartStatus,
    liveCurrentRoundTimestamp,
    liveCurrentRoundStartedAgo,
    liveCurrentRoundStatus,
    liveCurrentRoundNumber,
    updatedLiveStatus,
    trackedPeriodLabel,
    periodRewards,
    formattedAverageReward,
    formattedAllTimeTotalDistribution,
    completedRounds,
    currentRoundForCard,
    hasNoDataForPeriod,
    combinedError: combinedErrorState,
    dashboardOverallLoading: dashboardOverallLoadingState
  }
}
