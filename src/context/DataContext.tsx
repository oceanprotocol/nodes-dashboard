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
import { CountryStatsFilters, NodeFilters } from '../types/filters'
import { buildCountryStatsUrl } from '../shared/utils/urlBuilder'

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
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setSearchTerm: (term: string) => void
  setFilters: (filters: { [key: string]: any }) => void
  setSortModel: (model: { [key: string]: 'asc' | 'desc' }) => void
  totalNodes: number
  totalEligibleNodes: number
  totalRewards: number
  countryStats: CountryStatsType[]
  countryCurrentPage: number
  countryPageSize: number
  setCountryCurrentPage: (page: number) => void
  setCountryPageSize: (size: number) => void
  tableType: 'nodes' | 'countries'
  setTableType: (type: 'nodes' | 'countries') => void
  countrySearchTerm: string
  setCountrySearchTerm: (term: string) => void
  systemStats: SystemStats
  totalUptime: number | null
  rewardsHistory: Array<{
    date: string
    nrEligibleNodes: number
    totalAmount: number
  }>
  fetchRewardsHistory: () => Promise<any>
}

interface DataProviderProps {
  children: ReactNode
}

export const DataContext = createContext<DataContextType | undefined>(undefined)

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<NodeData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortModel, setSortModel] = useState<{ [key: string]: 'asc' | 'desc' }>({})
  const [filters, setFilters] = useState<{ [key: string]: any }>({})
  const [nextSearchAfter, setNextSearchAfter] = useState<any[] | null>(null)
  const [totalNodes, setTotalNodes] = useState<number>(0)
  const [totalEligibleNodes, setTotalEligibleNodes] = useState<number>(0)
  const [totalRewards, setTotalRewards] = useState<number>(0)
  const [countryStats, setCountryStats] = useState<CountryStatsType[]>([])
  const [countryCurrentPage, setCountryCurrentPage] = useState(1)
  const [countryPageSize, setCountryPageSize] = useState(10)
  const [tableType, setTableType] = useState<'nodes' | 'countries'>('nodes')
  const [countrySearchTerm, setCountrySearchTerm] = useState<string>('')
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuCounts: {},
    operatingSystems: {},
    cpuArchitectures: {}
  })
  const [totalUptime, setTotalUptime] = useState<number | null>(null)
  const [rewardsHistory, setRewardsHistory] = useState<
    Array<{
      date: string
      nrEligibleNodes: number
      totalAmount: number
    }>
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
    setLoading(true)
    try {
      const response = await axios.get(fetchUrl)

      let sanitizedData: NodeData[] = []
      for (let index = 0; index < response.data.nodes.length; index++) {
        const element = response.data.nodes[index]

        console.groupEnd()

        sanitizedData.push({
          ...element._source,
          index: (currentPage - 1) * pageSize + index + 1
        })
      }

      console.groupEnd()

      setData(sanitizedData)
      setTotalItems(response.data.pagination.totalItems)
      setNextSearchAfter(response.data.pagination.nextSearchAfter)
      setTotalNodes(response.data.pagination.totalItems)
      // setTotalEligibleNodes(response.data.totalEligibleNodes)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [fetchUrl])

  const getTotalEligible = useCallback(async () => {
    setLoading(true)
    const date = Date.now()
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000
    try {
      const oneWeekAgo = Math.floor(new Date(date - oneWeekInMs).getTime() / 1000)
      const response = await axios.get(
        `https://analytics.nodes.oceanprotocol.com/summary?date=${oneWeekAgo}`
      )

      setTotalEligibleNodes(response.data.numberOfRows)
    } catch (err) {
      console.error('Error total eligible nodes data:', err)
      const twoWeekAgo = Math.floor(new Date(date - 2 * oneWeekInMs).getTime() / 1000)
      const response = await axios.get(
        `https://analytics.nodes.oceanprotocol.com/summary?date=${twoWeekAgo}`
      )
      if (response) {
        setTotalEligibleNodes(response.data.numberOfRows)
      } else {
        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const getTotalRewards = useCallback(async () => {
    setLoading(true)
    try {
      const response = await axios.get(
        `https://analytics.nodes.oceanprotocol.com/all-summary`
      )

      setTotalRewards(response.data.cumulativeTotalAmount)
    } catch (err) {
      console.error('Error total eligible nodes data:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

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

  const fetchRewardsHistory = async () => {
    try {
      const response = await fetch(
        'https://analytics.nodes.oceanprotocol.com/rewards-history'
      )
      const data = await response.json()
      const formattedData = data.rewards.map((item: any) => ({
        date: item.date,
        background: { value: item.nrEligibleNodes },
        foreground: { value: item.totalAmount }
      }))
      setRewardsHistory(formattedData)
    } catch (error) {
      console.error('Error fetching rewards history:', error)
    }
  }

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
        await getTotalEligible()
        await getTotalRewards()
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
    countrySearchTerm
  ])

  useEffect(() => {
    const fetchTotalUptime = async () => {
      try {
        const now = Math.floor(Date.now() / 1000)

        const response = await axios.get(
          `https://incentive-backend.oceanprotocol.com/weekStats?date=${now}`
        )

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
        setCurrentPage: handleSetCurrentPage,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
        setFilters: handleSetFilters,
        countryStats,
        countryCurrentPage,
        countryPageSize,
        setCountryCurrentPage: handleSetCountryCurrentPage,
        setCountryPageSize: handleSetCountryPageSize,
        tableType,
        setTableType: handleSetTableType,
        countrySearchTerm,
        setCountrySearchTerm,
        systemStats,
        totalUptime,
        rewardsHistory,
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
