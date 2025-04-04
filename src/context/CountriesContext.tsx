import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback
} from 'react'
import axios from 'axios'
import { getApiRoute } from '@/config'
import { CountryStatsType } from '@/shared/types/dataTypes'
import { CountryStatsFilters } from '@/shared/types/filters'
import { GridFilterModel } from '@mui/x-data-grid'

interface CountriesContextType {
  data: CountryStatsType[]
  loading: boolean
  error: any
  currentPage: number
  pageSize: number
  totalItems: number
  searchTerm: string
  sortModel: Record<string, 'asc' | 'desc'>
  filters: CountryStatsFilters
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setSearchTerm: (term: string) => void
  setSortModel: (model: Record<string, 'asc' | 'desc'>) => void
  setFilters: (filters: CountryStatsFilters) => void
  setFilter: (filter: GridFilterModel) => void
}

const CountriesContext = createContext<CountriesContextType | undefined>(undefined)

interface CountriesProviderProps {
  children: ReactNode
}

export const CountriesProvider: React.FC<CountriesProviderProps> = ({ children }) => {
  // State
  const [data, setData] = useState<CountryStatsType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({})
  const [filters, setFilters] = useState<CountryStatsFilters>({})

  // Fetch data
  const fetchCountryStats = useCallback(async () => {
    try {
      const params: Record<string, any> = {
        page: currentPage,
        pageSize: pageSize
      }

      if (searchTerm) {
        params['filters[country][value]'] = searchTerm
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
            index: (currentPage - 1) * pageSize + index + 1,
            country: country.country,
            totalNodes: country.totalNodes,
            citiesWithNodes: country.citiesWithNodes,
            cityWithMostNodes: country.cityWithMostNodes,
            cityWithMostNodesCount: country.cityWithMostNodesCount
          })
        )
        setData(processedStats)
        setTotalItems(response.data.pagination.totalItems)
      } else {
        console.error('Unexpected data structure:', response.data)
        setData([])
        setTotalItems(0)
      }
    } catch (err) {
      console.error('Error fetching country stats:', err)
      setError(err)
      setData([])
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, filters, sortModel])

  // Effects
  useEffect(() => {
    fetchCountryStats()
  }, [fetchCountryStats])

  // Handlers
  const handleSetCurrentPage = (page: number) => {
    setCurrentPage(page)
  }

  const handleSetPageSize = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleSetSearchTerm = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const handleSetSortModel = (model: Record<string, 'asc' | 'desc'>) => {
    setSortModel(model)
    setCurrentPage(1)
  }

  const handleSetFilters = (newFilters: CountryStatsFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handleSetFilter = (filter: GridFilterModel) => {
    // Implementation of setFilter
  }

  const value: CountriesContextType = {
    data,
    loading,
    error,
    currentPage,
    pageSize,
    totalItems,
    searchTerm,
    sortModel,
    filters,
    setCurrentPage: handleSetCurrentPage,
    setPageSize: handleSetPageSize,
    setSearchTerm: handleSetSearchTerm,
    setSortModel: handleSetSortModel,
    setFilters: handleSetFilters,
    setFilter: handleSetFilter
  }

  return <CountriesContext.Provider value={value}>{children}</CountriesContext.Provider>
}

export const useCountriesContext = () => {
  const context = useContext(CountriesContext)
  if (context === undefined) {
    throw new Error('useCountriesContext must be used within a CountriesProvider')
  }
  return context
}
