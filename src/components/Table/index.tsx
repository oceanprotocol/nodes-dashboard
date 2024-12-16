import React, {
  JSXElementConstructor,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef
} from 'react'
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridToolbarProps,
  GridValidRowModel,
  GridFilterInputValue,
  GridFilterModel,
  useGridApiRef
} from '@mui/x-data-grid'

import styles from './index.module.css'

import { NodeData } from '../../shared/types/RowDataType'
import { useDataContext } from '@/context/DataContext'
import NodeDetails from './NodeDetails'
import { Button, Tooltip } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ReportIcon from '@mui/icons-material/Report'
import CustomToolbar from '../Toolbar'
import { styled } from '@mui/material/styles'
import CustomPagination from './CustomPagination'
import { FilterOperator, NodeFilters } from '../../types/filters'
import { debounce } from '../../shared/utils/debounce'
import {
  getAllNetworks,
  formatSupportedStorage,
  formatPlatform,
  formatUptimePercentage
} from './utils'

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  '& .MuiDataGrid-toolbarContainer': {
    display: 'flex',
    gap: '50px',
    '& .MuiButton-root': {
      fontFamily: 'Sharp Sans, sans-serif',
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: '21px',
      textAlign: 'left',
      color: '#000000',
      '& .MuiSvgIcon-root': {
        color: '#CF1FB1'
      }
    },
    '& .MuiBadge-badge': {
      backgroundColor: '#CF1FB1'
    }
  },
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e9ecef'
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontFamily: "'Sharp Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: '21px',
    textAlign: 'left',
    color: '#6c757d',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  '& .MuiDataGrid-cell': {
    fontFamily: "'Sharp Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 400,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  '& .MuiDataGrid-columnSeparator': {
    visibility: 'visible',
    color: '#E0E0E0'
  },
  '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-columnSeparator': {
    visibility: 'visible',
    color: '#BDBDBD'
  },
  '& .MuiDataGrid-columnHeader:hover': {
    '& .MuiDataGrid-columnSeparator': {
      visibility: 'visible'
    }
  },
  '& .MuiDataGrid-cellContent': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
}))

const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <ReportIcon style={{ color: 'orange' }} />
  )
}

interface DebouncedFunction {
  (value: string): void
  cancel: () => void
}

export default function Table({
  tableType = 'nodes'
}: {
  tableType?: 'nodes' | 'countries'
}) {
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
  const apiRef = useGridApiRef()
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setTableType(tableType)
  }, [tableType, setTableType])

  const nodeColumns: GridColDef<NodeData>[] = [
    {
      field: 'index',
      headerName: 'Index',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false
    },
    {
      field: 'id',
      headerName: 'Node ID',
      flex: 1,
      minWidth: 300,
      sortable: false,
      filterable: true,
      filterOperators: [
        {
          label: 'contains',
          value: 'contains',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              return params.value?.toLowerCase().includes(filterItem.value.toLowerCase())
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        }
      ]
    },
    {
      field: 'uptime',
      headerName: 'Weekly Uptime',
      sortable: true,
      flex: 1,
      minWidth: 150,
      filterable: true,
      headerClassName: styles.headerTitle,
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterValue = Number(filterItem.value) / 100
              const uptimePercentage = params.value / params.row.totalUptime
              return Math.abs(uptimePercentage - filterValue) <= 0.001
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: {
            type: 'number',
            step: '0.01',
            min: '0',
            max: '100',
            placeholder: 'Enter percentage (0-100)',
            error: !totalUptime,
            helperText: !totalUptime ? 'Loading uptime data...' : undefined
          }
        },
        {
          label: 'greater than',
          value: 'gt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterValue = Number(filterItem.value) / 100
              const uptimePercentage = params.value / params.row.totalUptime
              return uptimePercentage > filterValue
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: {
            type: 'number',
            step: '0.01',
            min: '0',
            max: '100',
            placeholder: 'Enter percentage (0-100)',
            error: !totalUptime,
            helperText: !totalUptime ? 'Loading uptime data...' : undefined
          }
        },
        {
          label: 'less than',
          value: 'lt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterValue = Number(filterItem.value) / 100
              const uptimePercentage = params.value / params.row.totalUptime
              return uptimePercentage < filterValue
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: {
            type: 'number',
            step: '0.01',
            min: '0',
            max: '100',
            placeholder: 'Enter percentage (0-100)',
            error: !totalUptime,
            helperText: !totalUptime ? 'Loading uptime data...' : undefined
          }
        }
      ],
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <UptimeCell uptimeInSeconds={params.row.uptime} totalUptime={totalUptime} />
      ),
      renderHeader: () => (
        <Tooltip title="Filter by uptime percentage (0-100)">
          <span>Weekly Uptime</span>
        </Tooltip>
      )
    },
    {
      field: 'dns',
      headerName: 'DNS / IP',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>
          {(params.row.ipAndDns?.dns || params.row.ipAndDns?.ip || '') +
            (params.row.ipAndDns?.port ? ':' + params.row.ipAndDns?.port : '')}
        </span>
      )
    },
    {
      field: 'dnsFilter',
      headerName: 'DNS / IP',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: true,
      hideable: false,
      filterOperators: [
        {
          label: 'contains',
          value: 'contains',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const dnsIpString =
                (params.row.ipAndDns?.dns || params.row.ipAndDns?.ip || '') +
                (params.row.ipAndDns?.port ? ':' + params.row.ipAndDns?.port : '')
              return dnsIpString.includes(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        }
      ]
    },
    {
      field: 'location',
      headerName: 'Location',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>
          {`${params.row.location?.city || ''} ${params.row.location?.country || ''}`}
        </span>
      )
    },
    {
      field: 'city',
      headerName: 'City',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: true,
      hideable: false,
      filterOperators: [
        {
          label: 'contains',
          value: 'contains',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              return (params.row.location?.city || '')
                .toLowerCase()
                .includes(filterItem.value.toLowerCase())
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        }
      ]
    },
    {
      field: 'country',
      headerName: 'Country',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: true,
      hideable: false,
      filterOperators: [
        {
          label: 'contains',
          value: 'contains',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              return (params.row.location?.country || '')
                .toLowerCase()
                .includes(filterItem.value.toLowerCase())
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        }
      ]
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
      minWidth: 150,
      sortable: false,
      filterable: false
    },
    {
      field: 'eligible',
      headerName: 'Last Check Eligibility',
      flex: 1,
      width: 80,
      filterable: false,
      sortable: true,
      renderHeader: () => (
        <Tooltip title="These nodes were eligible to receive rewards the proportion of their uptime at the last round checks.">
          <span className={styles.headerTitle}>Last Check Eligibility</span>
        </Tooltip>
      ),
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              return params.value === (filterItem.value === 'true')
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: {
            type: 'singleSelect',
            valueOptions: [
              { value: 'true', label: 'Eligible' },
              { value: 'false', label: 'Not Eligible' }
            ]
          }
        }
      ],
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span>{getEligibleCheckbox(params.row.eligible)}</span>
        </div>
      )
    },
    {
      field: 'eligibilityCauseStr',
      headerName: 'Eligibility Issue',
      flex: 1,
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{params.row.eligibilityCauseStr || 'none'}</span>
      )
    },
    {
      field: 'lastCheck',
      headerName: 'Last Check',
      flex: 1,
      minWidth: 140,
      filterable: true,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>
          {new Date(params?.row?.lastCheck)?.toLocaleString(undefined, {
            timeZoneName: 'short'
          })}
        </span>
      ),
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterDate = new Date(filterItem.value).getTime()
              const cellDate = new Date(params.value).getTime()
              return cellDate === filterDate
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'datetime-local' }
        },
        {
          label: 'after',
          value: 'gt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterDate = new Date(filterItem.value).getTime()
              const cellDate = new Date(params.value).getTime()
              return cellDate > filterDate
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'datetime-local' }
        },
        {
          label: 'before',
          value: 'lt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              const filterDate = new Date(filterItem.value).getTime()
              const cellDate = new Date(params.value).getTime()
              return cellDate < filterDate
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'datetime-local' }
        }
      ]
    },
    {
      field: 'network',
      headerName: 'Network',
      flex: 1,
      minWidth: 150,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{getAllNetworks(params.row.indexer)}</span>
      )
    },
    {
      field: 'viewMore',
      headerName: '',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <Button onClick={() => setSelectedNode(params.row)}>View More</Button>
      )
    },
    {
      field: 'publicKey',
      headerName: 'Public Key',
      flex: 1,
      sortable: false,
      minWidth: 200,
      filterable: false
    },
    {
      field: 'version',
      headerName: 'Version',
      flex: 1,
      minWidth: 100,
      sortable: false,
      filterable: false
    },
    {
      field: 'http',
      headerName: 'HTTP Enabled',
      flex: 1,
      minWidth: 100,
      sortable: false,
      filterable: false
    },
    {
      field: 'p2p',
      headerName: 'P2P Enabled',
      flex: 1,
      minWidth: 100,
      sortable: false,
      filterable: false
    },
    {
      field: 'supportedStorage',
      headerName: 'Supported Storage',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatSupportedStorage(params.row.supportedStorage)}</span>
      )
    },
    {
      field: 'platform',
      headerName: 'Platform',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatPlatform(params.row.platform)}</span>
      )
    },
    {
      field: 'codeHash',
      headerName: 'Code Hash',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false
    },
    {
      field: 'allowedAdmins',
      headerName: 'Allowed Admins',
      flex: 1,
      minWidth: 200,
      sortable: false,
      filterable: false
    }
  ]

  const countryColumns: GridColDef[] = [
    {
      field: 'index',
      headerName: 'Index',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false
    },
    {
      field: 'country',
      headerName: 'Country',
      flex: 1,
      minWidth: 200,
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      filterable: true,
      filterOperators: [
        {
          label: 'contains',
          value: 'contains',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              if (!filterItem.value) return true
              return params.value?.toLowerCase().includes(filterItem.value.toLowerCase())
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        },
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value === filterItem.value
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'text' }
        }
      ]
    },
    {
      field: 'totalNodes',
      headerName: 'Total Nodes',
      flex: 1,
      minWidth: 150,
      type: 'number',
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      filterable: true,
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value === Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'greater than',
          value: 'gt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value > Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'less than',
          value: 'lt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value < Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        }
      ]
    },
    {
      field: 'citiesWithNodes',
      headerName: 'Cities with Nodes',
      flex: 1,
      minWidth: 200,
      type: 'number',
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      filterable: true,
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value === Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'greater than',
          value: 'gt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value > Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'less than',
          value: 'lt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value < Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        }
      ]
    },
    {
      field: 'cityWithMostNodes',
      headerName: 'City with Most Nodes',
      flex: 1,
      minWidth: 200,
      align: 'left',
      headerAlign: 'left',
      sortable: true,
      filterable: true,
      valueGetter: (params: { row: any }) => {
        return params.row?.cityWithMostNodesCount || 0
      },
      filterOperators: [
        {
          label: 'equals',
          value: 'eq',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value === Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'greater than',
          value: 'gt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value > Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        },
        {
          label: 'less than',
          value: 'lt',
          getApplyFilterFn: (filterItem) => {
            return (params) => {
              return params.value < Number(filterItem.value)
            }
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: 'number' }
        }
      ],
      renderCell: (params: GridRenderCellParams) => (
        <span>
          {params.row.cityWithMostNodes} ({params.row.cityWithMostNodesCount} nodes)
        </span>
      )
    }
  ]

  const UptimeCell: React.FC<{
    uptimeInSeconds: number
    totalUptime: number | null
  }> = ({ uptimeInSeconds, totalUptime }) => {
    if (totalUptime === null) {
      return <span>Loading...</span>
    }

    return <span>{formatUptimePercentage(uptimeInSeconds, totalUptime)}</span>
  }

  const handlePaginationChange = useCallback(
    (paginationModel: { page: number; pageSize: number }) => {
      const newPage = paginationModel.page + 1
      const newPageSize = paginationModel.pageSize

      if (tableType === 'countries') {
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

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    if (newSortModel.length > 0) {
      const { field, sort } = newSortModel[0]
      if (tableType === 'countries') {
        const sortField = field === 'cityWithMostNodes' ? 'cityWithMostNodesCount' : field
        const allowedSortFields = [
          'totalNodes',
          'citiesWithNodes',
          'cityWithMostNodesCount'
        ]
        if (allowedSortFields.includes(sortField)) {
          setSortModel({ [sortField]: sort as 'asc' | 'desc' })
        }
      } else if (tableType === 'nodes') {
        setSortModel({ [field]: sort as 'asc' | 'desc' })
      }
    } else {
      setSortModel({})
    }
  }

  const debouncedHandleFilterChange = useCallback(
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
      }, 1000)

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
          tableType === 'countries' ? setCountrySearchTerm : setSearchTerm
        setContextSearchTerm(value)
        timeoutIdRef.current = null
      }, 1000)
    }

    debouncedFn.cancel = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
    }

    return debouncedFn
  }, [tableType, setCountrySearchTerm, setSearchTerm])

  const handleSearchChange = (searchValue: string) => {
    const setLocalTerm =
      tableType === 'countries' ? setLocalSearchTermCountry : setLocalSearchTerm
    setLocalTerm(searchValue)

    if (!searchValue) {
      debouncedSearchFn.cancel()
      const setContextTerm =
        tableType === 'countries' ? setCountrySearchTerm : setSearchTerm
      setContextTerm('')
      return
    }

    debouncedSearchFn(searchValue)
  }

  const handleReset = () => {
    const currentSearchTerm = tableType === 'countries' ? searchTermCountry : searchTerm

    if (currentSearchTerm) {
      const setLocalTerm =
        tableType === 'countries' ? setLocalSearchTermCountry : setLocalSearchTerm
      const setContextTerm =
        tableType === 'countries' ? setCountrySearchTerm : setSearchTerm

      setLocalTerm('')
      setContextTerm('')
      debouncedSearchFn.cancel()
    }
  }

  const columns = tableType === 'countries' ? countryColumns : nodeColumns
  const data = useMemo(() => {
    return tableType === 'countries' ? countryStats : nodeData
  }, [tableType, nodeData, countryStats])

  return (
    <div className={styles.root}>
      <div style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <StyledDataGrid
          rows={data}
          columns={columns as GridColDef<GridValidRowModel>[]}
          slots={{
            toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps>
          }}
          slotProps={{
            toolbar: {
              searchTerm: tableType === 'countries' ? searchTermCountry : searchTerm,
              onSearchChange: handleSearchChange,
              onReset: handleReset,
              tableType: tableType,
              apiRef: apiRef.current
            }
          }}
          initialState={{
            columns: {
              columnVisibilityModel:
                tableType === 'nodes'
                  ? {
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
                    }
                  : {}
            },
            pagination: {
              paginationModel: {
                pageSize: tableType === 'countries' ? countryPageSize : pageSize,
                page: (tableType === 'countries' ? countryCurrentPage : currentPage) - 1
              }
            },
            density: 'comfortable'
          }}
          pagination
          disableColumnMenu
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{
            page: (tableType === 'countries' ? countryCurrentPage : currentPage) - 1,
            pageSize: tableType === 'countries' ? countryPageSize : pageSize
          }}
          onPaginationModelChange={handlePaginationChange}
          loading={loading}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          onSortModelChange={handleSortModelChange}
          onFilterModelChange={debouncedHandleFilterChange}
          rowCount={totalItems}
          autoHeight={false}
          hideFooter={true}
          processRowUpdate={(
            newRow: GridValidRowModel,
            oldRow: GridValidRowModel
          ): GridValidRowModel => {
            const processCell = (value: unknown) => {
              if (typeof value === 'object' && value !== null) {
                if ('dns' in value || 'ip' in value) {
                  const dnsIpObj = value as { dns?: string; ip?: string; port?: string }
                  return `${dnsIpObj.dns || dnsIpObj.ip}${dnsIpObj.port ? ':' + dnsIpObj.port : ''}`
                }

                if ('city' in value || 'country' in value) {
                  const locationObj = value as { city?: string; country?: string }
                  return `${locationObj.city} ${locationObj.country}`
                }
              }
              return value
            }

            return Object.fromEntries(
              Object.entries(newRow).map(([key, value]) => [key, processCell(value)])
            ) as GridValidRowModel
          }}
          apiRef={apiRef}
        />
      </div>
      <CustomPagination
        page={tableType === 'countries' ? countryCurrentPage : currentPage}
        pageSize={tableType === 'countries' ? countryPageSize : pageSize}
        totalItems={totalItems}
        onPageChange={(page: number) =>
          tableType === 'countries' ? setCountryCurrentPage(page) : setCurrentPage(page)
        }
        onPageSizeChange={(size: number) =>
          tableType === 'countries' ? setCountryPageSize(size) : setPageSize(size)
        }
      />
      {selectedNode && (
        <NodeDetails nodeData={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}
