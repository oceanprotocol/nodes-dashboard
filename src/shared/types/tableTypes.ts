import { TableTypeEnum } from '../enums/TableTypeEnum'
import { GridFilterModel, GridSortModel, GridValidRowModel } from '@mui/x-data-grid'
import { NodeData } from './RowDataType'
import { Dispatch, SetStateAction } from 'react'
import { CountryStatsType } from './dataTypes'

// Sort Fields Configuration
export const SORT_FIELDS = {
  [TableTypeEnum.COUNTRIES]: [
    'totalNodes',
    'citiesWithNodes',
    'cityWithMostNodesCount'
  ] as const,
  [TableTypeEnum.NODES]: ['uptime', 'eligible', 'lastCheck'] as const
} as const

export type CountrySortFields = (typeof SORT_FIELDS)[TableTypeEnum.COUNTRIES][number]
export type NodeSortFields = (typeof SORT_FIELDS)[TableTypeEnum.NODES][number]

export interface TableProps {
  tableType?: TableTypeEnum
}

export interface TableState {
  selectedNode: NodeData | null
  searchTerm: string
  searchTermCountry: string
}

export interface FilterConfig {
  value: string
  operator: FilterOperator
}

export interface NodeFilters {
  [key: string]: FilterConfig
}

export type FilterOperator = 'contains' | 'eq' | 'gt' | 'lt'

export type DebouncedFunction = {
  (value: string): void
  cancel: () => void
}

export interface TableHandlers {
  handlePaginationChange: (paginationModel: { page: number; pageSize: number }) => void
  handleSortModelChange: (sortModel: GridSortModel) => void
  handleFilterChange: (filterModel: GridFilterModel) => void
  handleSearchChange: (searchValue: string) => void
  handleReset: () => void
}

export interface TableHookReturn {
  data: CountryStatsType[] | NodeData[]
  loading: boolean
  selectedNode: NodeData | null
  setSelectedNode: Dispatch<SetStateAction<NodeData | null>>
  searchTerm: string
  searchTermCountry: string
  currentPage: number
  pageSize: number
  countryCurrentPage: number
  countryPageSize: number
  setCurrentPage: (page: number) => void
  setPageSize: (size: number) => void
  setCountryCurrentPage: (page: number) => void
  setCountryPageSize: (size: number) => void
  totalItems: number
  totalUptime: number | null
  handlePaginationChange: TableHandlers['handlePaginationChange']
  handleSortModelChange: TableHandlers['handleSortModelChange']
  handleFilterChange: TableHandlers['handleFilterChange']
  handleSearchChange: TableHandlers['handleSearchChange']
  handleReset: TableHandlers['handleReset']
}
