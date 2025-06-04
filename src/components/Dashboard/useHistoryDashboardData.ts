import { useMemo } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import duration from 'dayjs/plugin/duration'
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

export const getElapsedSinceLastThursday = (startTimestampMillis: number): string => {
  dayjs.extend(utc)
  dayjs.extend(timezone)
  dayjs.extend(duration)

  const CET = 'Europe/Berlin'

  if (!startTimestampMillis) return 'Invalid timestamp'

  const timestamp = dayjs(startTimestampMillis).tz(CET)

  // Calculate the previous Thursday 00:00 CET
  let previousThursday =
    timestamp.day() >= 4 ? timestamp.day(4) : timestamp.subtract(1, 'week').day(4)
  previousThursday = previousThursday.startOf('day')

  const diffMs = timestamp.diff(previousThursday)

  if (diffMs < 0) return 'Before previous Thursday'

  const d = dayjs.duration(diffMs)
  const formatted = `${d.days()}d:${d.hours()}h:${d.minutes()}m`

  return formatted
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
    [nodesData?.uptime, weekStats?.totalUptime]
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
    () => (currentRoundStats?.round + 1)?.toString() ?? '-',
    [currentRoundStats]
  )

  const updatedLiveStatus = useMemo(() => isLive(weekStats?.lastRun || 0), [weekStats])
  const trackedPeriodLabel = useMemo(
    () => getElapsedSinceLastThursday(weekStats?.timestamp || 0),
    [weekStats]
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
    () => (weekStats?.round ? Math.max(0, weekStats.round) : '-'),
    [weekStats]
  )

  const currentRoundForCard = useMemo(
    () => (weekStats?.round + 1)?.toString(),
    [weekStats]
  )

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
