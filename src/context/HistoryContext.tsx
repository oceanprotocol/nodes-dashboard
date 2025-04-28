import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback
} from 'react'
import { getNodeHistory, getWeekStats } from '@/services/historyService'
import dayjs from 'dayjs'
import { DateRange } from '@/components/PeriodSelect'

interface WeekStatsSource {
  id: number
  week: number
  totalUptime: number
  lastRun: number
  round: number
  timestamp: number
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
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

interface HistoryProviderProps {
  children: ReactNode
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({ children }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [nodeId, setNodeId] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: dayjs().subtract(30, 'day'),
    endDate: dayjs()
  })

  const [weekStats, setWeekStats] = useState<WeekStatsSource | null>(null)
  const [loadingWeekStats, setLoadingWeekStats] = useState<boolean>(false)
  const [errorWeekStats, setErrorWeekStats] = useState<any>(null)

  const fetchHistoryData = useCallback(async () => {
    if (!nodeId) return

    console.log(
      `[HistoryContext] Attempting fetchHistoryData for nodeId: ${nodeId}, page: ${currentPage}, size: ${pageSize}`
    )

    setLoading(true)
    setError(null)
    try {
      const response = await getNodeHistory(nodeId, currentPage, pageSize)
      console.log('[HistoryContext] Received history data:', response)
      setData(response.data || [])
      setTotalItems(response.pagination.totalCount || 0)
    } catch (error) {
      console.error('[HistoryContext] Error during fetchHistoryData:', error)
      setData([])
      setTotalItems(0)
      setError(error)
    } finally {
      console.log('[HistoryContext] Finished fetchHistoryData attempt.')
      setLoading(false)
    }
  }, [nodeId, currentPage, pageSize])

  const fetchWeekStats = useCallback(async () => {
    if (!nodeId || !dateRange.endDate) {
      console.log('[HistoryContext] Skipping fetchWeekStats: Missing nodeId or endDate')
      return
    }

    const targetDate = dateRange.endDate.unix()
    console.log(
      `[HistoryContext] Attempting fetchWeekStats for nodeId: ${nodeId}, date: ${targetDate}`
    )

    setLoadingWeekStats(true)
    setErrorWeekStats(null)
    setWeekStats(null)
    try {
      const stats = await getWeekStats(targetDate)
      console.log('[HistoryContext] Received weekStats data:', stats)
      setWeekStats(stats)
    } catch (err) {
      console.error('[HistoryContext] Error during fetchWeekStats:', err)
      setWeekStats(null)
      setErrorWeekStats(err)
    } finally {
      console.log('[HistoryContext] Finished fetchWeekStats attempt.')
      setLoadingWeekStats(false)
    }
  }, [nodeId, dateRange])

  useEffect(() => {
    if (isSearching && nodeId) {
      console.log(
        '[HistoryContext] Triggering fetches due to search/nodeId/dependencies change.'
      )
      fetchHistoryData()
      fetchWeekStats()
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
  }, [])

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
    setDateRange,
    setCurrentPage,
    setPageSize,
    setIsSearching,
    clearHistory,
    fetchHistoryData,
    weekStats,
    loadingWeekStats,
    errorWeekStats,
    fetchWeekStats
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
