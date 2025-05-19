import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useMemo,
  useCallback
} from 'react'
import axios from 'axios'
import { NodeData } from '@/shared/types/RowDataType'
import { getApiRoute } from '@/config'
import { SystemStats } from '@/shared/types/dataTypes'
import { NodeFilters } from '@/shared/types/filters'
import { GridFilterModel } from '@mui/x-data-grid'

interface RewardHistoryItem {
  date: string
  background: { value: number }
  foreground: { value: number }
  weeklyAmount: number
}

interface AverageIncentiveDataItem {
  date: string
  foreground: { value: number }
  totalRewards: number
  totalNodes: number
}

interface NodesContextType {
  data: NodeData[]
  loading: boolean
  error: any
  currentPage: number
  pageSize: number
  totalItems: number
  searchTerm: string
  sortModel: Record<string, 'asc' | 'desc'>
  filters: Record<string, any>
  nextSearchAfter: any[] | null
  totalNodes: number | null
  totalEligibleNodes: number | null
  totalRewards: number | null
  systemStats: SystemStats
  totalUptime: number | null
  rewardsHistory: RewardHistoryItem[]
  loadingTotalNodes: boolean
  loadingRewardsHistory: boolean
  loadingTotalEligible: boolean
  loadingTotalRewards: boolean
  averageIncentiveData: AverageIncentiveDataItem[]
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setSearchTerm: (term: string) => void
  setFilters: (filters: { [key: string]: any }) => void
  setSortModel: (model: { [key: string]: 'asc' | 'desc' }) => void
  setFilter: (filter: GridFilterModel) => void
  fetchRewardsHistory: () => Promise<any>
}

const NodesContext = createContext<NodesContextType | undefined>(undefined)

interface NodesProviderProps {
  children: ReactNode
}

export const NodesProvider: React.FC<NodesProviderProps> = ({ children }) => {
  const [data, setData] = useState<NodeData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(100)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({})
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [nextSearchAfter, setNextSearchAfter] = useState<any[] | null>(null)

  const [totalNodes, setTotalNodes] = useState<number | null>(null)
  const [totalEligibleNodes, setTotalEligibleNodes] = useState<number | null>(null)
  const [totalRewards, setTotalRewards] = useState<number | null>(null)
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuCounts: {},
    operatingSystems: {},
    cpuArchitectures: {}
  })
  const [totalUptime, setTotalUptime] = useState<number | null>(null)
  const [rewardsHistory, setRewardsHistory] = useState<RewardHistoryItem[]>([])
  const [loadingTotalNodes, setLoadingTotalNodes] = useState<boolean>(false)
  const [loadingRewardsHistory, setLoadingRewardsHistory] = useState<boolean>(false)
  const [loadingTotalEligible, setLoadingTotalEligible] = useState<boolean>(false)
  const [loadingTotalRewards, setLoadingTotalRewards] = useState<boolean>(false)
  const [metricsLoaded, setMetricsLoaded] = useState<boolean>(false)
  const [averageIncentiveData, setAverageIncentiveData] = useState<
    AverageIncentiveDataItem[]
  >([])

  const sortParams = useMemo(() => {
    return Object.entries(sortModel)
      .map(([field, order]) => `sort[${field}]=${order}`)
      .join('&')
  }, [sortModel])

  const buildFilterParams = (filters: NodeFilters): string => {
    if (!filters || Object.keys(filters).length === 0) return ''
    return Object.entries(filters)
      .filter(([_, filterData]) => filterData?.value && filterData?.operator)
      .map(([field, filterData]) => {
        if (field === 'id') {
          const ids = filterData.value.split(',').map((id: string) => id.trim())
          return `filters[${field}][value]=${ids.join(',')}`
        }
        return `filters[${field}][${filterData.operator}]=${filterData.value}`
      })
      .join('&')
  }

  const fetchUrl = useMemo(() => {
    let url = `${getApiRoute('nodes')}?page=${currentPage}&size=${pageSize}`
    if (sortParams) {
      url += `&${sortParams}`
    }
    const filterString = buildFilterParams(filters)
    if (filterString) {
      url += `&${filterString}`
    }
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`
    }
    return url
  }, [currentPage, pageSize, sortParams, filters, searchTerm])

  const fetchData = useCallback(async () => {
    const isDefaultView =
      (!searchTerm || searchTerm.trim() === '') &&
      (Object.keys(filters).length === 0 ||
        Object.values(filters).every((filter: any) => !filter || !filter.value))
    setLoading(true)
    if (isDefaultView && !metricsLoaded) {
      setLoadingTotalNodes(true)
    }
    try {
      const response = await axios.get(fetchUrl)
      const sanitizedData = response.data.nodes.map((element: any, index: number) => ({
        ...element._source,
        index: (currentPage - 1) * pageSize + index + 1
      }))
      setData(sanitizedData)
      setTotalItems(response.data.pagination.totalItems)
      setNextSearchAfter(response.data.pagination.nextSearchAfter)
      if (isDefaultView && !metricsLoaded) {
        setTotalNodes(response.data.pagination.totalItems)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err)
    } finally {
      setLoading(false)
      if (isDefaultView && !metricsLoaded) {
        setLoadingTotalNodes(false)
      }
    }
  }, [currentPage, fetchUrl, pageSize, searchTerm, filters, metricsLoaded])

  const getTotalEligible = useCallback(async () => {
    if (!metricsLoaded) setLoadingTotalEligible(true)
    const date = Date.now()
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000
    const oneWeekAgo = Math.floor(new Date(date - oneWeekInMs).getTime() / 1000)
    try {
      const response = await axios.get(
        `${getApiRoute('analyticsSummary')}?date=${oneWeekAgo}`
      )
      setTotalEligibleNodes(response.data.numberOfRows)
    } catch (err) {
      console.error('Error total eligible nodes data:', err)
      const twoWeekAgo = Math.floor(new Date(date - 2 * oneWeekInMs).getTime() / 1000)
      try {
        const response = await axios.get(
          `${getApiRoute('analyticsSummary')}?date=${twoWeekAgo}`
        )
        if (response) {
          setTotalEligibleNodes(response.data.numberOfRows)
        }
      } catch (fallbackErr) {
        console.error('Error in fallback fetch:', fallbackErr)
        const threeWeeksAgo = Math.floor(new Date(date - 3 * oneWeekInMs).getTime() / 1000)
        try {
        const response = await axios.get(
          `${getApiRoute('analyticsSummary')}?date=${threeWeeksAgo}`
        )
        if (response) {
          setTotalEligibleNodes(response.data.numberOfRows)
        }
      } catch (fallbackErr) {
        console.error('Error in fallback fetch:', fallbackErr)
        setError(err)
      }
    }
    } finally {
      if (!metricsLoaded) setLoadingTotalEligible(false)
    }
  }, [metricsLoaded])

  const getTotalRewards = useCallback(async () => {
    if (!metricsLoaded) setLoadingTotalRewards(true)
    try {
      const response = await axios.get(getApiRoute('analyticsAllSummary'))
      setTotalRewards(response.data.cumulativeTotalAmount)
    } catch (err) {
      console.error('Error fetching rewards data:', err)
      setError(err)
    } finally {
      if (!metricsLoaded) setLoadingTotalRewards(false)
    }
  }, [metricsLoaded])

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await axios.get(getApiRoute('nodeSystemStats'))
      if (response.data) {
        setSystemStats(response.data)
      }
    } catch (err) {
      console.error('Error fetching system stats:', err)
    }
  }, [])

  const fetchRewardsHistory = useCallback(async () => {
    try {
      const response = await fetch(getApiRoute('analyticsRewardsHistory'))
      const data = await response.json()

      const sortedRewardsForCumulative = [...data.rewards].sort(
        (a, b) => parseInt(a.date) - parseInt(b.date)
      )

      let cumulativeAmount = 0
      const formattedData = sortedRewardsForCumulative.map((item) => {
        cumulativeAmount += item.totalAmount
        return {
          date: item.date,
          background: { value: item.nrEligibleNodes },
          foreground: { value: cumulativeAmount },
          weeklyAmount: item.totalAmount
        }
      })

      const averageData = data.rewards.map((item: any) => {
        const average =
          item.nrEligibleNodes > 0 ? item.totalAmount / item.nrEligibleNodes : 0

        return {
          date: item.date,
          foreground: { value: average },
          totalRewards: item.totalAmount,
          totalNodes: item.nrEligibleNodes
        }
      })

      setRewardsHistory(formattedData)
      setAverageIncentiveData(averageData)
      setLoadingRewardsHistory(false)
    } catch (error) {
      console.error('Error fetching rewards history:', error)
      setLoadingRewardsHistory(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const fetchAllData = async () => {
      if (!mounted) return
      try {
        await fetchData()
        if (!systemStats.cpuCounts || Object.keys(systemStats.cpuCounts).length === 0) {
          await fetchSystemStats()
        }
        const isDefaultView =
          (!searchTerm || searchTerm.trim() === '') &&
          (Object.keys(filters).length === 0 ||
            Object.values(filters).every((filter: any) => !filter || !filter.value))
        if (isDefaultView && !metricsLoaded) {
          await getTotalEligible()
          await getTotalRewards()
          setMetricsLoaded(true)
        }
        await fetchRewardsHistory()
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchAllData()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [
    currentPage,
    pageSize,
    filters,
    sortModel,
    searchTerm,
    systemStats.cpuCounts,
    metricsLoaded,
    getTotalEligible,
    getTotalRewards,
    fetchRewardsHistory,
    fetchData,
    fetchSystemStats
  ])

  useEffect(() => {
    const fetchTotalUptime = async () => {
      try {
        const now = Math.floor(Date.now() / 1000)
        const response = await axios.get(`${getApiRoute('weekStats')}?date=${now}`)
        if (response?.data && response.data.length > 0) {
          const totalUptimeValue = response.data[0]._source.totalUptime
          setTotalUptime(totalUptimeValue)
        }
      } catch (error) {
        console.error('Failed to fetch total uptime:', error)
      }
    }
    fetchTotalUptime()
  }, [])

  const handleSetCurrentPage = (page: number) => {
    setCurrentPage(page)
  }

  const handleSetPageSize = (size: number) => {
    setPageSize(size)
    setData([])
    setNextSearchAfter(null)
  }

  const handleSetSearchTerm = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
    setNextSearchAfter(null)
  }

  const handleSetSortModel = (model: { [key: string]: 'asc' | 'desc' }) => {
    setSortModel(model)
    setCurrentPage(1)
    setNextSearchAfter(null)
  }

  const handleSetFilters = (newFilters: { [key: string]: any }) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handleSetFilter = (filter: GridFilterModel) => {
    // Implementation of handleSetFilter
  }

  return (
    <NodesContext.Provider
      value={{
        data,
        loading,
        error,
        currentPage,
        pageSize,
        totalItems,
        searchTerm,
        sortModel,
        filters,
        nextSearchAfter,
        totalNodes,
        totalEligibleNodes,
        totalRewards,
        loadingTotalNodes,
        systemStats,
        totalUptime,
        rewardsHistory,
        loadingRewardsHistory,
        loadingTotalEligible,
        loadingTotalRewards,
        averageIncentiveData,
        setCurrentPage: handleSetCurrentPage,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
        setFilters: handleSetFilters,
        setFilter: handleSetFilter,
        fetchRewardsHistory
      }}
    >
      {children}
    </NodesContext.Provider>
  )
}

export const useNodesContext = () => {
  const context = useContext(NodesContext)
  if (context === undefined) {
    throw new Error('useNodesContext must be used within a NodesProvider')
  }
  return context
}
