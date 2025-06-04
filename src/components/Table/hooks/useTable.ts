import { useCallback, useMemo, useRef, useState } from 'react'
import { GridFilterModel, GridSortModel } from '@mui/x-data-grid'
import { useNodesContext } from '@/context/NodesContext'
import { useCountriesContext } from '@/context/CountriesContext'
import { useHistoryContext } from '@/context/HistoryContext'
import { TableTypeEnum } from '../../../shared/enums/TableTypeEnum'
import { NodeData } from '../../../shared/types/RowDataType'

export const useTable = (tableType: TableTypeEnum) => {
  const {
    data: nodesData,
    loading: nodesLoading,
    currentPage: nodesCurrentPage,
    pageSize: nodesPageSize,
    totalItems: nodesTotalItems,
    setCurrentPage: setNodesCurrentPage,
    setPageSize: setNodesPageSize,
    setFilter: setNodesFilter,
    totalUptime
  } = useNodesContext()

  const {
    data: countryData,
    loading: countriesLoading,
    currentPage: countriesCurrentPage,
    pageSize: countriesPageSize,
    totalItems: countriesTotalItems,
    setCurrentPage: setCountriesCurrentPage,
    setPageSize: setCountriesPageSize,
    setFilter: setCountriesFilter
  } = useCountriesContext()

  const {
    data: historyData,
    loading: historyLoading,
    currentPage: historyCurrentPage,
    pageSize: historyPageSize,
    totalItems: historyTotalItems,
    setCurrentPage: setHistoryCurrentPage,
    setPageSize: setHistoryPageSize,
    nodeId,
    setNodeId
  } = useHistoryContext()

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchTermCountry, setSearchTermCountry] = useState<string>('')
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const data = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodesData
      case TableTypeEnum.COUNTRIES:
        return countryData
      case TableTypeEnum.HISTORY:
        return historyData
      default:
        return []
    }
  }, [tableType, nodesData, countryData, historyData])

  const loading = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodesLoading
      case TableTypeEnum.COUNTRIES:
        return countriesLoading
      case TableTypeEnum.HISTORY:
        return historyLoading
      default:
        return false
    }
  }, [tableType, nodesLoading, countriesLoading, historyLoading])

  const currentPage = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodesCurrentPage
      case TableTypeEnum.COUNTRIES:
        return countriesCurrentPage
      case TableTypeEnum.HISTORY:
        return historyCurrentPage
      default:
        return 1
    }
  }, [tableType, nodesCurrentPage, countriesCurrentPage, historyCurrentPage])

  const pageSize = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodesPageSize
      case TableTypeEnum.COUNTRIES:
        return countriesPageSize
      case TableTypeEnum.HISTORY:
        return historyPageSize
      default:
        return 10
    }
  }, [tableType, nodesPageSize, countriesPageSize, historyPageSize])

  const totalItems = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodesTotalItems
      case TableTypeEnum.COUNTRIES:
        return countriesTotalItems
      case TableTypeEnum.HISTORY:
        return historyTotalItems
      default:
        return 0
    }
  }, [tableType, nodesTotalItems, countriesTotalItems, historyTotalItems])

  const handlePaginationChange = useCallback(
    (model: { page: number; pageSize: number }) => {
      switch (tableType) {
        case TableTypeEnum.NODES:
          setNodesCurrentPage(model.page + 1)
          setNodesPageSize(model.pageSize)
          break
        case TableTypeEnum.COUNTRIES:
          setCountriesCurrentPage(model.page + 1)
          setCountriesPageSize(model.pageSize)
          break
        case TableTypeEnum.HISTORY:
          setHistoryCurrentPage(model.page + 1)
          setHistoryPageSize(model.pageSize)
          break
      }
    },
    [
      tableType,
      setNodesCurrentPage,
      setNodesPageSize,
      setCountriesCurrentPage,
      setCountriesPageSize,
      setHistoryCurrentPage,
      setHistoryPageSize
    ]
  )

  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
      if (model.length > 0) {
        const { field, sort } = model[0]
        const filterModel: GridFilterModel = {
          items: [
            {
              id: 1,
              field,
              operator: 'sort',
              value: sort
            }
          ]
        }

        switch (tableType) {
          case TableTypeEnum.NODES:
            setNodesFilter(filterModel)
            break
          case TableTypeEnum.COUNTRIES:
            setCountriesFilter(filterModel)
            break
        }
      }
    },
    [tableType, setNodesFilter, setCountriesFilter]
  )

  const handleFilterChange = useCallback(
    (model: GridFilterModel) => {
      switch (tableType) {
        case TableTypeEnum.NODES:
          setNodesFilter(model)
          break
        case TableTypeEnum.COUNTRIES:
          setCountriesFilter(model)
          break
        case TableTypeEnum.HISTORY:
          if (model.items?.[0]?.field === 'id') {
            setNodeId(model.items[0].value as string)
          }
          break
      }
    },
    [tableType, setNodesFilter, setCountriesFilter, setNodeId]
  )

  const handleSearchChange = useCallback(
    (term: string) => {
      const filterModel: GridFilterModel = {
        items: [{ field: 'name', operator: 'contains', value: term }]
      }

      if (tableType === TableTypeEnum.COUNTRIES) {
        setSearchTermCountry(term)
        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current)
        }
        searchTimeout.current = setTimeout(() => {
          setCountriesFilter(filterModel)
        }, 500)
      } else {
        setSearchTerm(term)
        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current)
        }
        searchTimeout.current = setTimeout(() => {
          setNodesFilter(filterModel)
        }, 500)
      }
    },
    [tableType, setNodesFilter, setCountriesFilter]
  )

  const handleReset = useCallback(() => {
    const emptyFilter: GridFilterModel = { items: [] }

    if (tableType === TableTypeEnum.COUNTRIES) {
      setSearchTermCountry('')
      setCountriesFilter(emptyFilter)
    } else {
      setSearchTerm('')
      setNodesFilter(emptyFilter)
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }
  }, [tableType, setNodesFilter, setCountriesFilter])

  return {
    data,
    loading,
    currentPage,
    pageSize,
    totalItems,
    selectedNode,
    setSelectedNode,
    searchTerm,
    searchTermCountry,
    totalUptime,
    nodeId,
    handlePaginationChange,
    handleSortModelChange,
    handleFilterChange,
    handleSearchChange,
    handleReset
  }
}
