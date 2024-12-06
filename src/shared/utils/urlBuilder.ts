import { CountryStatsFilters, PaginationParams, SortModel } from '../../types/filters'

export function buildCountryStatsUrl(
  baseUrl: string,
  pagination: PaginationParams,
  filters?: CountryStatsFilters,
  sort?: SortModel
): string {
  const params = new URLSearchParams()

  params.append('page', pagination.page.toString())
  params.append('pageSize', pagination.pageSize.toString())

  if (filters) {
    Object.entries(filters).forEach(([field, filterData]) => {
      if (filterData?.value && filterData?.operator) {
        params.append(`filters[${field}][operator]`, filterData.operator)
        params.append(`filters[${field}][value]`, filterData.value)
      }
    })
  }

  if (sort) {
    Object.entries(sort).forEach(([field, order]) => {
      params.append(`sort[${field}]`, order)
    })
  }

  return `${baseUrl}?${params.toString()}`
}
