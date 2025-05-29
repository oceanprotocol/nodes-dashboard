import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
  useMemo,
  PropsWithChildren
} from 'react'
import {
  getNodeHistory,
  getWeekStats,
  getAllHistoricalWeeklyPeriods,
  PeriodOption,
  RewardsData,
  getAllHistoricalRewards,
  getCurrentWeekStats
} from '@/services/historyService'
import { DateRange } from '@/components/PeriodSelect'

export interface WeekStatsSource {
  id: number
  week: number
  totalUptime: number
  lastRun: number
  round?: number
  timestamp?: number
}

interface HistoryContextType {
  data: any[]
  loading: boolean
  error: any
  currentPage: number
  pageSize: number
  totalItems: number
  nodeId: string
  dateRange: DateRange
  isSearching: boolean
  setNodeId: (id: string) => void
  setDateRange: (range: DateRange) => void
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setIsSearching: (isSearching: boolean) => void
  clearHistory: () => void
  fetchHistoryData: () => Promise<void>
  weekStats: WeekStatsSource | null
  loadingWeekStats: boolean
  errorWeekStats: any
  fetchWeekStats: () => Promise<void>
  availablePeriods: PeriodOption[]
  periodsLoading: boolean
  getRewardsForPeriod: (periodId: string | number) => {
    averageReward: number
    totalDistributed: number
    nrEligibleNodes: number
  } | null
  rewardsData: RewardsData[]
  loadingRewards: boolean
  errorRewards: Error | null
  totalProgramDistribution: number
  currentRoundStats: any
  loadingCurrentRound: boolean
  errorCurrentRound: Error | null
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

export const HistoryProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [nodeId, setNodeId] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null
  })

  const [weekStats, setWeekStats] = useState<WeekStatsSource | null>(null)
  const [loadingWeekStats, setLoadingWeekStats] = useState<boolean>(false)
  const [errorWeekStats, setErrorWeekStats] = useState<any>(null)

  const [availablePeriods, setAvailablePeriods] = useState<PeriodOption[]>([])
  const [periodsLoading, setPeriodsLoading] = useState<boolean>(true)

  const [rewardsData, setRewardsData] = useState<RewardsData[]>([])
  const [loadingRewards, setLoadingRewards] = useState<boolean>(false)
  const [errorRewards, setErrorRewards] = useState<Error | null>(null)

  const [currentRoundStats, setCurrentRoundStats] = useState<any>(null)
  const [loadingCurrentRound, setLoadingCurrentRound] = useState<boolean>(false)
  const [errorCurrentRound, setErrorCurrentRound] = useState<Error | null>(null)

  useEffect(() => {
    const fetchPeriods = async () => {
      setPeriodsLoading(true)
      try {
        const periods = await getAllHistoricalWeeklyPeriods()
        setAvailablePeriods(periods)
        if (periods.length > 0) {
          const mostRecentPeriod = periods[0]
          setDateRange({
            startDate: mostRecentPeriod.startDate,
            endDate: mostRecentPeriod.endDate
          })
        }
      } catch (err) {
        console.error('[HistoryContext] Error fetching available periods:', err)
      } finally {
        setPeriodsLoading(false)
      }
    }
    fetchPeriods()
  }, [])

  const fetchHistoryData = useCallback(async () => {
    if (!nodeId || !dateRange.startDate || !dateRange.endDate) {
      return
    }

    console.log(
      `[HistoryContext] Attempting fetchHistoryData for nodeId: ${nodeId}, page: ${currentPage}, size: ${pageSize}, range: ${dateRange.startDate?.format()} - ${dateRange.endDate?.format()}`
    )

    setLoading(true)
    setError(null)
    try {
      const response = await getNodeHistory(
        nodeId,
        currentPage,
        pageSize,
        dateRange.startDate,
        dateRange.endDate
      )
      console.log('[HistoryContext] Received history data:', response)
      setData(response.data || [])
      setTotalItems(response.pagination.totalCount || 0)
    } catch (error) {
      console.error('[HistoryContext] Error during fetchHistoryData:', error)
      setData([])
      setTotalItems(0)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [nodeId, currentPage, pageSize, dateRange])

  const fetchWeekStats = useCallback(async () => {
    if (!nodeId || !dateRange.endDate) {
      return
    }

    const targetDate = dateRange.endDate.unix()

    setLoadingWeekStats(true)
    setErrorWeekStats(null)
    setWeekStats(null)
    try {
      const stats = await getWeekStats(targetDate)
      setWeekStats(stats)
    } catch (err) {
      console.error('[HistoryContext] Error during fetchWeekStats:', err)
      setWeekStats(null)
      setErrorWeekStats(err)
    } finally {
      setLoadingWeekStats(false)
    }
  }, [nodeId, dateRange])

  useEffect(() => {
    if (isSearching && nodeId && dateRange.startDate && dateRange.endDate) {
      const fetchData = async () => {
        await fetchHistoryData()
        await fetchWeekStats()
        setIsSearching(false)
      }

      fetchData()
    } else if (isSearching && nodeId && (!dateRange.startDate || !dateRange.endDate)) {
      console.log(
        '[HistoryContext] Waiting for initial date range to be set after periods load.'
      )
    }
  }, [
    isSearching,
    nodeId,
    dateRange,
    currentPage,
    pageSize,
    fetchHistoryData,
    fetchWeekStats
  ])

  const clearHistory = useCallback(() => {
    setNodeId('')
    setIsSearching(false)
    setData([])
    setTotalItems(0)
    setCurrentPage(1)
    setError(null)
    setWeekStats(null)
    setErrorWeekStats(null)
    if (availablePeriods.length > 0) {
      const mostRecentPeriod = availablePeriods[0]
      setDateRange({
        startDate: mostRecentPeriod.startDate,
        endDate: mostRecentPeriod.endDate
      })
    } else {
      setDateRange({ startDate: null, endDate: null })
    }
  }, [availablePeriods])

  const handleSetDateRange = useCallback(
    (newRange: DateRange) => {
      console.log(
        `[HistoryContext] Setting new date range: ${newRange.startDate?.format('YYYY-MM-DD')} to ${newRange.endDate?.format('YYYY-MM-DD')}`
      )

      if (newRange.startDate && newRange.endDate) {
        setDateRange(newRange)

        if (nodeId && nodeId.trim() !== '') {
          setIsSearching(true)
        }
      } else {
        console.log('[HistoryContext] Ignoring invalid date range (missing dates)')
      }
    },
    [nodeId]
  )

  useEffect(() => {
    const fetchRewardsData = async () => {
      try {
        setLoadingRewards(true)
        const data = await getAllHistoricalRewards()
        setRewardsData(data)
        setErrorRewards(null)
      } catch (error) {
        console.error('Error fetching rewards data:', error)
        setErrorRewards(error as Error)
      } finally {
        setLoadingRewards(false)
      }
    }

    fetchRewardsData()
  }, [])

  useEffect(() => {
    const fetchCurrentRound = async () => {
      try {
        setLoadingCurrentRound(true)
        const data = await getCurrentWeekStats()
        console.log('🚀 ~ data:', data)
        setCurrentRoundStats(data)
        setErrorCurrentRound(null)
      } catch (error) {
        console.error('Error fetching current round:', error)
        setErrorCurrentRound(error as Error)
      } finally {
        setLoadingCurrentRound(false)
      }
    }

    fetchCurrentRound()
  }, [])

  const getRewardsForPeriod = (
    periodId: string | number
  ): {
    averageReward: number
    totalDistributed: number
    nrEligibleNodes: number
  } | null => {
    if (!periodId || rewardsData.length === 0) return null

    const periodIdStr = periodId.toString()
    const periodRewards = rewardsData.find((reward) => reward.date === periodIdStr)

    if (!periodRewards) return null

    const averageReward = periodRewards.totalAmount / periodRewards.nrEligibleNodes

    return {
      averageReward,
      totalDistributed: periodRewards.totalAmount,
      nrEligibleNodes: periodRewards.nrEligibleNodes
    }
  }

  const totalProgramDistribution = useMemo(() => {
    if (!Array.isArray(rewardsData) || rewardsData.length === 0) return 0
    return rewardsData.reduce((sum, reward) => {
      return sum + (reward?.totalAmount || 0)
    }, 0)
  }, [rewardsData])

  const value: HistoryContextType = {
    data,
    loading,
    error,
    currentPage,
    pageSize,
    totalItems,
    nodeId,
    dateRange,
    isSearching,
    setNodeId,
    setDateRange: handleSetDateRange,
    setCurrentPage,
    setPageSize,
    setIsSearching,
    clearHistory,
    fetchHistoryData,
    weekStats,
    loadingWeekStats,
    errorWeekStats,
    fetchWeekStats,
    availablePeriods,
    periodsLoading,
    getRewardsForPeriod,
    rewardsData,
    loadingRewards,
    errorRewards,
    totalProgramDistribution,
    currentRoundStats,
    loadingCurrentRound,
    errorCurrentRound
  }

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}

export const useHistoryContext = () => {
  const context = useContext(HistoryContext)
  if (context === undefined) {
    throw new Error('useHistoryContext must be used within a HistoryProvider')
  }
  return context
}
