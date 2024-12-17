import { TableTypeEnum } from '../../shared/enums/TableTypeEnum'
import { GridFilterOperator } from '@mui/x-data-grid'

export const SORT_FIELDS = {
  [TableTypeEnum.COUNTRIES]: [
    'totalNodes',
    'citiesWithNodes',
    'cityWithMostNodesCount'
  ] as const,
  [TableTypeEnum.NODES]: ['uptime', 'eligible', 'lastCheck'] as const
} as const

type CountrySortFields = (typeof SORT_FIELDS)[TableTypeEnum.COUNTRIES][number]
type NodeSortFields = (typeof SORT_FIELDS)[TableTypeEnum.NODES][number]

export type TableSortFields = {
  [TableTypeEnum.COUNTRIES]: CountrySortFields
  [TableTypeEnum.NODES]: NodeSortFields
}

export const TABLE_CONFIG = {
  DEBOUNCE_DELAY: 1000,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  DEFAULT_DENSITY: 'comfortable' as const,
  DEFAULT_PAGE_SIZE: 10,

  HIDDEN_COLUMNS: {
    [TableTypeEnum.NODES]: {
      network: false,
      publicKey: false,
      version: false,
      http: false,
      p2p: false,
      supportedStorage: false,
      platform: false,
      codeHash: false,
      allowedAdmins: false,
      dnsFilter: false,
      city: false,
      country: false
    },
    [TableTypeEnum.COUNTRIES]: {}
  },

  SORT_FIELDS,

  FILTER_OPERATORS: {
    CONTAINS: 'contains',
    EQUALS: 'eq',
    GREATER_THAN: 'gt',
    LESS_THAN: 'lt'
  } as const,

  GRID_STYLE: {
    HEIGHT: 'calc(100vh - 200px)',
    WIDTH: '100%'
  }
} as const

export type FilterOperatorType =
  (typeof TABLE_CONFIG.FILTER_OPERATORS)[keyof typeof TABLE_CONFIG.FILTER_OPERATORS]
