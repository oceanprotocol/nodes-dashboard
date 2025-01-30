import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { GridFilterModel, GridSortModel, GridValidRowModel } from '@mui/x-data-grid'
import { useDataContext } from '@/context/DataContext'
import { TableTypeEnum } from '../../../shared/enums/TableTypeEnum'
import { NodeData } from '../../../shared/types/RowDataType'
import {
  DebouncedFunction,
  CountrySortFields,
  NodeSortFields,
  NodeFilters,
  FilterOperator,
  TableHookReturn
} from '../../../shared/types/tableTypes'
import { debounce } from '../../../shared/utils/debounce'
import { TABLE_CONFIG } from '../tableConfig'

export function useTable(tableType: TableTypeEnum): TableHookReturn {
  const {
    data: nodeData,
    countryStats,
    loading,
    currentPage,
    pageSize,
    totalItems,
    setCurrentPage,
    setPageSize,
    setTableType,
    filters,
    setFilters,
    setSortModel,
    setSearchTerm,
    countryCurrentPage,
    setCountryCurrentPage,
    countryPageSize,
    setCountryPageSize,
    setCountrySearchTerm,
    totalUptime
  } = useDataContext()

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [searchTerm, setLocalSearchTerm] = useState<string>('')
  const [searchTermCountry, setLocalSearchTermCountry] = useState<string>('')
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setTableType(tableType)
  }, [tableType, setTableType])

  const data = useMemo(() => {
    return tableType === TableTypeEnum.COUNTRIES ? countryStats : nodeData
  }, [tableType, nodeData, countryStats])

  const handlePaginationChange = useCallback(
    (paginationModel: { page: number; pageSize: number }) => {
      const newPage = paginationModel.page + 1
      const newPageSize = paginationModel.pageSize

      if (tableType === TableTypeEnum.COUNTRIES) {
        setCountryCurrentPage(newPage)
        if (newPageSize !== countryPageSize) {
          setCountryPageSize(newPageSize)
        }
      } else {
        setCurrentPage(newPage)
        if (newPageSize !== pageSize) {
          setPageSize(newPageSize)
        }
      }
    },
    [
      tableType,
      setCurrentPage,
      setPageSize,
      setCountryCurrentPage,
      setCountryPageSize,
      countryPageSize,
      pageSize
    ]
  )

  const handleSortModelChange = useCallback(
    (newSortModel: GridSortModel) => {
      if (newSortModel.length > 0) {
        const { field, sort } = newSortModel[0]
        if (tableType === TableTypeEnum.COUNTRIES) {
          const sortField =
            field === 'cityWithMostNodes' ? 'cityWithMostNodesCount' : field
          if (
            TABLE_CONFIG.SORT_FIELDS[TableTypeEnum.COUNTRIES].includes(
              sortField as CountrySortFields
            )
          ) {
            setSortModel({ [sortField]: sort as 'asc' | 'desc' })
          }
        } else if (tableType === TableTypeEnum.NODES) {
          if (
            TABLE_CONFIG.SORT_FIELDS[TableTypeEnum.NODES].includes(
              field as NodeSortFields
            )
          ) {
            setSortModel({ [field]: sort as 'asc' | 'desc' })
          }
        }
      } else {
        setSortModel({})
      }
    },
    [tableType, setSortModel]
  )

  const handleFilterChange = useCallback(
    (filterModel: GridFilterModel) => {
      const debouncedFilter = debounce((model: GridFilterModel) => {
        if (!model.items.some((item) => item.value)) {
          setFilters({})
          return
        }

        const newFilters: NodeFilters = {}

        model.items.forEach((item) => {
          if (item.value && item.field) {
            if (item.field === 'dnsFilter') {
              newFilters.dns = {
                value: String(item.value),
                operator: 'contains' as FilterOperator
              }
            } else if (item.field === 'uptime' && totalUptime !== null) {
              const percentageValue = Number(item.value)
              const rawSeconds = (percentageValue / 100) * totalUptime
              newFilters.uptime = {
                value: rawSeconds.toString(),
                operator: item.operator as FilterOperator
              }
            } else if (item.field === 'city' || item.field === 'country') {
              newFilters[item.field] = {
                value: String(item.value),
                operator: item.operator as FilterOperator
              }
            } else {
              newFilters[item.field as keyof NodeFilters] = {
                value: String(item.value),
                operator: item.operator as FilterOperator
              }
            }
          }
        })

        setFilters(newFilters)
      }, TABLE_CONFIG.DEBOUNCE_DELAY)

      debouncedFilter(filterModel)
    },
    [setFilters, totalUptime]
  )

  const debouncedSearchFn = useMemo<DebouncedFunction>(() => {
    const debouncedFn = (value: string) => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      timeoutIdRef.current = setTimeout(() => {
        const setContextSearchTerm =
          tableType === TableTypeEnum.COUNTRIES ? setCountrySearchTerm : setSearchTerm
        setContextSearchTerm(value)
        timeoutIdRef.current = null
      }, TABLE_CONFIG.DEBOUNCE_DELAY)
    }

    debouncedFn.cancel = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }

    return debouncedFn
  }, [tableType, setCountrySearchTerm, setSearchTerm])

  const handleSearchChange = useCallback(
    (searchValue: string) => {
      const setLocalTerm =
        tableType === TableTypeEnum.COUNTRIES
          ? setLocalSearchTermCountry
          : setLocalSearchTerm
      setLocalTerm(searchValue)

      if (!searchValue) {
        debouncedSearchFn.cancel()
        const setContextTerm =
          tableType === TableTypeEnum.COUNTRIES ? setCountrySearchTerm : setSearchTerm
        setContextTerm('')
        return
      }

      debouncedSearchFn(searchValue)
    },
    [
      tableType,
      setLocalSearchTermCountry,
      setLocalSearchTerm,
      debouncedSearchFn,
      setCountrySearchTerm,
      setSearchTerm
    ]
  )

  const handleReset = useCallback(() => {
    const currentSearchTerm =
      tableType === TableTypeEnum.COUNTRIES ? searchTermCountry : searchTerm

    if (currentSearchTerm) {
      const setLocalTerm =
        tableType === TableTypeEnum.COUNTRIES
          ? setLocalSearchTermCountry
          : setLocalSearchTerm
      const setContextTerm =
        tableType === TableTypeEnum.COUNTRIES ? setCountrySearchTerm : setSearchTerm

      setLocalTerm('')
      setContextTerm('')
      debouncedSearchFn.cancel()
    }
  }, [
    tableType,
    searchTermCountry,
    searchTerm,
    setLocalSearchTermCountry,
    setLocalSearchTerm,
    setCountrySearchTerm,
    setSearchTerm,
    debouncedSearchFn
  ])

  return {
    data,
    loading,
    selectedNode,
    setSelectedNode,
    searchTerm,
    searchTermCountry,
    currentPage,
    pageSize,
    countryCurrentPage,
    countryPageSize,
    setCurrentPage,
    setPageSize,
    setCountryCurrentPage,
    setCountryPageSize,
    totalItems,
    totalUptime,
    handlePaginationChange,
    handleSortModelChange,
    handleFilterChange,
    handleSearchChange,
    handleReset
  }
}
