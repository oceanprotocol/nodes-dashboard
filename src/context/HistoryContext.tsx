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
import { NodeData } from '@/shared/types/RowDataType'
import axios from 'axios'

export interface WeekStatsSource {
  id: number
  week: number
  totalUptime: number
  lastRun: number
  round?: number
  timestamp?: number
}

export interface HistoryContextType {
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
  isInitialising: boolean,
  nodesData: NodeData
  loadingNodeData: boolean
  errorNodeData: Error | null
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

  const [nodesData, setNodesData] = useState<NodeData>({} as NodeData)
  const [loadingNodeData, setLoadingNodeData] = useState<boolean>(false)
  const [errorNodeData, setErrorNodeData] = useState<Error | null>(null)

  const [currentRoundStats, setCurrentRoundStats] = useState<any>(null)
  const [loadingCurrentRound, setLoadingCurrentRound] = useState<boolean>(false)
  const [errorCurrentRound, setErrorCurrentRound] = useState<Error | null>(null)
  const [isInitialising, setIsInitialising] = useState<boolean>(true)

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsInitialising(true)
      try {
        const doFetchPeriods = async () => {
          setPeriodsLoading(true)
          try {
            const periods = await getAllHistoricalWeeklyPeriods()
            console.log(
              '[HistoryContext] Available periods fetched successfully:',
              periods
            )
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

        const doFetchRewardsData = async () => {
          setLoadingRewards(true)
          try {
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

        const doFetchCurrentRound = async () => {
          setLoadingCurrentRound(true)
          try {
            const data = await getCurrentWeekStats()
            console.log(
              '[HistoryContext] Current round stats fetched successfully:',
              data
            )
            setCurrentRoundStats(data)
            setErrorCurrentRound(null)
          } catch (error) {
            console.error('Error fetching current round in initial:', error)
            setErrorCurrentRound(error as Error)
          } finally {
            setLoadingCurrentRound(false)
          }
        }

        const doFetchNodeData = async () => {
          if (!nodeId) return

          try {
            setLoadingNodeData(true)

            const data = await getNodeData(nodeId)
            console.log(
              '[HistoryContext] Node data fetched successfully:',
              data
            )
            if (!data) {
              setErrorNodeData(new Error('Node data is empty or undefined'))
              console.error(
                '[HistoryContext] Node data is empty or undefined for nodeId:',
                nodeId
              )
            } else {
              setNodesData(data)
              setErrorNodeData(null)
            }
            setLoadingNodeData(false)
          } catch (error) {
            console.error('Error fetching node data in initial:', error)
            setErrorNodeData(error as Error)
          }
        }

        await Promise.all([doFetchPeriods(), doFetchRewardsData(), doFetchCurrentRound(), doFetchNodeData()])
      } catch (error) {
        console.error(
          '[HistoryContext] Error during initial parallel fetches (Promise.all):',
          error
        )
      } finally {
        setIsInitialising(false)
      }
    }
    fetchInitialData()
  }, [nodeId])

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
    errorCurrentRound,
    isInitialising,
    nodesData, 
    loadingNodeData,
    errorNodeData
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

export const getNodeData = async (
  nodeId: string,
): Promise<NodeData> => {
  try {
    let url = `https://incentive-backend.oceanprotocol.com/nodes?nodeId=${nodeId}`
    
    const response = await axios.get(url)
    console.log('[getNodeDetails] Response from node data API:', response)
    return response?.data?.nodes[0]?._source as NodeData
  } catch (error) {
    console.error('[getNodeDetails] Error fetching node details:', error)
    throw error
  }
}

