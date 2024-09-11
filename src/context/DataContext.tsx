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
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
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
  const [maxCurrentPage, setMaxCurrentPage] = useState<number>(0)

  useEffect(() => {
    const fetchData = async (page: number = 1, size: number = 10) => {
      try {
        const url = `http://localhost:3000/nodes?page=${page}&size=${size}`

        const response = await axios.get(url)

        let sanitizedData: NodeData[] = []
        for (let index = 0; index < response.data.nodes.length; index++) {
          const element = response.data.nodes[index]
          sanitizedData.push(element._source)
        }

        const updatedData = page === 1 ? sanitizedData : [...data, ...sanitizedData]

        setData(updatedData)

        const totalItems = response.data.pagination.totalItems
        const totalPagesFromResponse = response.data.pagination.totalPages
        setMaxCurrentPage(page)
        setTotalPages(totalPagesFromResponse)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    if (currentPage > maxCurrentPage || pageSize !== data.length / currentPage) {
      fetchData(currentPage, pageSize)
    }
  }, [currentPage, pageSize])

  const handleSetCurrentPage = (page: number) => {
    setCurrentPage(page)
  }

  const handleSetPageSize = (size: number) => {
    setPageSize(size)
    setData([])
    setMaxCurrentPage(0)
  }

  const dataWithIndex = useMemo(() => {
    return data
      .sort((a, b) => {
        if (a.eligible !== b.eligible) {
          return a.eligible ? -1 : 1
        }
        return b.uptime - a.uptime
      })
      .map((item, idx) => ({
        ...item,
        index: (currentPage - 1) * pageSize + idx + 1,
        dns: item.ipAndDns?.dns
      }))
  }, [data, currentPage, pageSize])

  return (
    <DataContext.Provider
      value={{
        data: dataWithIndex,
        loading,
        error,
        currentPage,
        pageSize,
        totalPages,
        setCurrentPage: handleSetCurrentPage,
        setPageSize: handleSetPageSize
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
