import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useMemo
} from 'react'
import axios from 'axios'
import { NodeData } from '@/shared/types/RowDataType'

interface DataContextType {
  data: NodeData[]
  loading: boolean
  error: any
  currentPage: number
  pageSize: number
  totalPages: number
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
  const [totalPages, setTotalPages] = useState<number>(100)
  const [totalItems, setTotalItems] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortModel, setSortModel] = useState<{ [key: string]: 'asc' | 'desc' }>({})
  const [filters, setFilters] = useState<{ [key: string]: any }>({})
  const [nextSearchAfter, setNextSearchAfter] = useState<any[] | null>(null)

  const sortParams = useMemo(() => {
    return Object.entries(sortModel)
      .map(([field, order]) => `sort[${field}]=${order}`)
      .join('&')
  }, [sortModel])

  const filterParams = useMemo(() => {
    return Object.entries(filters)
      .map(([key, value]) => `filters[${key}]=${value}`)
      .join('&')
  }, [filters])

  const fetchUrl = useMemo(() => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://incentive-backend.oceanprotocol.com'
    let url = `${baseUrl}/nodes?page=${currentPage}&size=${pageSize}`

    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`
    }

    if (sortParams) {
      url += `&${sortParams}`
    }

    if (filterParams && Object.keys(filterParams).length > 0) {
      url += `&${filterParams}`
    }

    if (nextSearchAfter) {
      url += `&searchAfter=${encodeURIComponent(JSON.stringify(nextSearchAfter))}`
    }

    return url
  }, [currentPage, pageSize, searchTerm, sortParams, filterParams, nextSearchAfter])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await axios.get(fetchUrl)

        let sanitizedData: NodeData[] = []
        for (let index = 0; index < response.data.nodes.length; index++) {
          const element = response.data.nodes[index]
          sanitizedData.push({
            ...element._source,
            index: (currentPage - 1) * pageSize + index + 1
          })
        }

        const updatedData =
          currentPage === 1 ? sanitizedData : [...data, ...sanitizedData]

        setData(updatedData)
        setTotalItems(response.data.pagination.totalItems)
        setTotalPages(response.data.pagination.totalPages)
        setNextSearchAfter(response.data.pagination.nextSearchAfter)
      } catch (err) {
        console.log('error', err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fetchUrl])

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

  return (
    <DataContext.Provider
      value={{
        data,
        loading,
        error,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        searchTerm,
        sortModel,
        filters,
        nextSearchAfter,
        setCurrentPage: handleSetCurrentPage,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
        setFilters: handleSetFilters
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
