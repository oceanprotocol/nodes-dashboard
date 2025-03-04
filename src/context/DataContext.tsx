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
import { CountryStatsType, SystemStats } from '../shared/types/dataTypes'
import { CountryStatsFilters, NodeFilters } from '../shared/types/filters'
import { buildCountryStatsUrl } from '../shared/utils/urlBuilder'

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

interface DataContextType {
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
  countryStats: CountryStatsType[]
  countryCurrentPage: number
  countryPageSize: number
  tableType: 'nodes' | 'countries'
  countrySearchTerm: string
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
  setCountryCurrentPage: (page: number) => void
  setCountryPageSize: (size: number) => void
  setTableType: (type: 'nodes' | 'countries') => void
  setCountrySearchTerm: (term: string) => void
  fetchRewardsHistory: () => Promise<any>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: ReactNode
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<NodeData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({})
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [nextSearchAfter, setNextSearchAfter] = useState<any[] | null>(null)

  const [totalNodes, setTotalNodes] = useState<number | null>(null)
  const [totalEligibleNodes, setTotalEligibleNodes] = useState<number | null>(null)
  const [totalRewards, setTotalRewards] = useState<number | null>(null)
  const [countryStats, setCountryStats] = useState<CountryStatsType[]>([])
  const [countryCurrentPage, setCountryCurrentPage] = useState<number>(1)
  const [countryPageSize, setCountryPageSize] = useState<number>(10)
  const [tableType, setTableType] = useState<'nodes' | 'countries'>('nodes')
  const [countrySearchTerm, setCountrySearchTerm] = useState<string>('')
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
        setError(err)
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

  const fetchCountryStats = useCallback(async () => {
    try {
      const params: Record<string, any> = {
        page: countryCurrentPage,
        pageSize: countryPageSize
      }
      if (countrySearchTerm) {
        params['filters[country][value]'] = countrySearchTerm
        params['filters[country][operator]'] = 'contains'
      }
      if (filters && Object.keys(filters).length > 0) {
        Object.entries(filters).forEach(([field, filterData]) => {
          const { value, operator } = filterData
          params[`filters[${field}][value]`] = value
          params[`filters[${field}][operator]`] = operator
        })
      }
      if (sortModel && Object.keys(sortModel).length > 0) {
        const [field, order] = Object.entries(sortModel)[0]
        const sortField = field === 'cityWithMostNodes' ? 'cityWithMostNodesCount' : field
        params[`sort[${sortField}]`] = order
      }
      const response = await axios.get(getApiRoute('countryStats'), { params })
      if (response.data && Array.isArray(response.data.countryStats)) {
        const processedStats = response.data.countryStats.map(
          (country: any, index: number) => ({
            id: country.country,
            index: (countryCurrentPage - 1) * countryPageSize + index + 1,
            country: country.country,
            totalNodes: country.totalNodes,
            citiesWithNodes: country.citiesWithNodes,
            cityWithMostNodes: country.cityWithMostNodes,
            cityWithMostNodesCount: country.cityWithMostNodesCount
          })
        )
        setCountryStats(processedStats)
        setTotalItems(response.data.pagination.totalItems)
      } else {
        console.error('Unexpected data structure:', response.data)
        setCountryStats([])
        setTotalItems(0)
      }
    } catch (err) {
      console.error('Error fetching country stats:', err)
      setCountryStats([])
      setTotalItems(0)
    }
  }, [countryCurrentPage, countryPageSize, countrySearchTerm, filters, sortModel])

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
        if (tableType === 'nodes') {
          await fetchData()
        } else {
          await fetchCountryStats()
        }
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
    tableType,
    currentPage,
    pageSize,
    countryCurrentPage,
    countryPageSize,
    filters,
    sortModel,
    searchTerm,
    countrySearchTerm,
    systemStats.cpuCounts,
    metricsLoaded,
    getTotalEligible,
    getTotalRewards,
    fetchRewardsHistory,
    fetchData,
    fetchCountryStats,
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

  const handleSetCountryCurrentPage = (page: number) => {
    setCountryCurrentPage(page)
  }

  const handleSetCountryPageSize = (size: number) => {
    setCountryPageSize(size)
  }

  const handleSetTableType = (type: 'nodes' | 'countries') => {
    setTableType(type)
  }

  const buildUrl = useCallback(() => {
    const pagination = {
      page: tableType === 'countries' ? countryCurrentPage : currentPage,
      pageSize: tableType === 'countries' ? countryPageSize : pageSize
    }
    const baseUrl = tableType === 'countries' ? '/api/countryStats' : '/api/nodes'
    return buildCountryStatsUrl(
      baseUrl,
      pagination,
      filters as CountryStatsFilters,
      sortModel
    )
  }, [
    tableType,
    currentPage,
    countryCurrentPage,
    pageSize,
    countryPageSize,
    filters,
    sortModel
  ])

  return (
    <DataContext.Provider
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
        countryStats,
        countryCurrentPage,
        countryPageSize,
        tableType,
        countrySearchTerm,
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
        setCountryCurrentPage: handleSetCountryCurrentPage,
        setCountryPageSize: handleSetCountryPageSize,
        setTableType: handleSetTableType,
        setCountrySearchTerm,
        fetchRewardsHistory
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export const useDataContext = () => {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider')
  }
  return context
}
