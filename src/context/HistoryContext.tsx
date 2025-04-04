import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback
} from 'react'
import { getNodeHistory } from '@/services/historyService'
import dayjs from 'dayjs'
import { DateRange } from '@/components/PeriodSelect'

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

  const fetchHistoryData = useCallback(async () => {
    if (!nodeId || !dateRange.startDate || !dateRange.endDate) return

    setLoading(true)
    try {
      const response = await getNodeHistory(
        nodeId,
        dateRange.startDate.unix(),
        currentPage,
        pageSize
      )
      setData(response.items || [])
      setTotalItems(response.total || 0)
      setError(null)
    } catch (error) {
      console.error('Error fetching node history:', error)
      setData([])
      setTotalItems(0)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [nodeId, dateRange, currentPage, pageSize])

  useEffect(() => {
    if (isSearching && nodeId) {
      fetchHistoryData()
    }
  }, [isSearching, nodeId, dateRange, currentPage, pageSize, fetchHistoryData])

  const clearHistory = useCallback(() => {
    setNodeId('')
    setIsSearching(false)
    setData([])
    setTotalItems(0)
    setCurrentPage(1)
    setError(null)
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
    fetchHistoryData
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
