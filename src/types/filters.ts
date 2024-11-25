export type StringFilterOperator = 'contains' | 'eq'
export type NumberFilterOperator = 'eq' | 'gt' | 'lt'
export type FilterOperator = StringFilterOperator | NumberFilterOperator

export interface FilterValue {
  operator: FilterOperator
  value: string
}

export interface CountryStatsFilters {
  country?: {
    operator: StringFilterOperator
    value: string
  }
  totalNodes?: {
    operator: NumberFilterOperator
    value: string
  }
  citiesWithNodes?: {
    operator: NumberFilterOperator
    value: string
  }
  cityWithMostNodes?: {
    operator: StringFilterOperator
    value: string
  }
  cityWithMostNodesCount?: {
    operator: NumberFilterOperator
    value: string
  }
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface SortModel {
  [field: string]: 'asc' | 'desc'
}
