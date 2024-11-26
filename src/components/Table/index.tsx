import React, {
  JSXElementConstructor,
  useState,
  useMemo,
  useEffect,
  useCallback
} from 'react'
import axios from 'axios'
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridToolbarProps,
  GridValidRowModel,
  GridFilterInputValue,
  GridFilterModel,
  GridValueGetter
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
import { FilterOperator, CountryStatsFilters } from '../../types/filters'

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

const getAllNetworks = (indexers: NodeData['indexer']): string => {
  return indexers?.map((indexer) => indexer.network).join(', ')
}

export const formatSupportedStorage = (
  supportedStorage: NodeData['supportedStorage']
): string => {
  const storageTypes = []

  if (supportedStorage?.url) storageTypes.push('URL')
  if (supportedStorage?.arwave) storageTypes.push('Arweave')
  if (supportedStorage?.ipfs) storageTypes.push('IPFS')

  return storageTypes.join(', ')
}

export const formatPlatform = (platform: NodeData['platform']): string => {
  if (platform) {
    const { cpus, arch, machine, platform: platformName, osType, node } = platform
    return `CPUs: ${cpus}, Architecture: ${arch}, Machine: ${machine}, Platform: ${platformName}, OS Type: ${osType}, Node.js: ${node}`
  }
  return ''
}

export const formatUptime = (uptimeInSeconds: number): string => {
  const days = Math.floor(uptimeInSeconds / (3600 * 24))
  const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600)
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60)

  const dayStr = days > 0 ? `${days} day${days > 1 ? 's' : ''} ` : ''
  const hourStr = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ` : ''
  const minuteStr = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : ''

  return `${dayStr}${hourStr}${minuteStr}`.trim()
}
const formatUptimePercentage = (uptimeInSeconds: number, totalUptime: number): string => {
  console.log('real uptimeInSeconds: ', uptimeInSeconds)
  console.log('real totalUptime: ', totalUptime)

  const uptimePercentage = (uptimeInSeconds / totalUptime) * 100
  console.log('real uptime percentage: ', uptimePercentage)
  const percentage = uptimePercentage > 100 ? 100 : uptimePercentage
  return `${percentage.toFixed(2)}%`
}

const UptimeCell: React.FC<{ uptimeInSeconds: number; lastCheck: number }> = ({
  uptimeInSeconds,
  lastCheck
}) => {
  const [totalUptime, setTotalUptime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTotalUptime = async () => {
      try {
        const response = await axios.get(
          `https://incentive-backend.oceanprotocol.com/weekStats?date=${(lastCheck / 1000).toFixed(0)}`
        )
        const data = response?.data
        if (data && data.length > 0) {
          setTotalUptime(data[0]._source.totalUptime)
        } else {
          throw new Error('Invalid API response')
        }
      } catch (error) {
        setError('Failed to fetch uptime data')
      }
    }

    fetchTotalUptime()
  }, [lastCheck])

  if (error) {
    return <span>{error}</span>
  }

  if (totalUptime === null) {
    return <span>Loading...</span>
  }

  return <span>{formatUptimePercentage(uptimeInSeconds, totalUptime)}</span>
}

const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <ReportIcon style={{ color: 'orange' }} />
  )
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
    setCountrySearchTerm
  } = useDataContext()

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [searchTerm, setLocalSearchTerm] = useState<string>('')
  const [searchTermCountry, setLocalSearchTermCountry] = useState<string>('')

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
      sortable: false
    },
    {
      field: 'id',
      headerName: 'Node ID',
      flex: 1,
      minWidth: 300,
      sortable: false
    },
    {
      field: 'uptime',
      headerName: 'Weekly Uptime',
      sortable: true,
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <UptimeCell
          uptimeInSeconds={params.row.uptime}
          lastCheck={params.row.lastCheck}
        />
      )
    },
    {
      field: 'dns',
      headerName: 'DNS / IP',
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>
          {(params.row.ipAndDns?.dns || params.row.ipAndDns?.ip || '') +
            (params.row.ipAndDns?.port ? ':' + params.row.ipAndDns?.port : '')}
        </span>
      )
    },
    {
      field: 'location',
      headerName: 'Location',
      flex: 1,
      minWidth: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{`${params.row.location?.city || ''} ${params.row.location?.country || ''}`}</span>
      )
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
      minWidth: 150,
      sortable: false
    },
    {
      field: 'eligible',
      headerName: 'Last Check Eligibility',
      flex: 1,
      width: 80,
      renderHeader: () => (
        <Tooltip
          title="These nodes were eligible to receive rewards the proportion of their uptime 
           at the last round checks."
        >
          <span>Last Check Eligibility</span>
        </Tooltip>
      ),
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
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{params.row.eligibilityCauseStr || 'none'}</span>
      )
    },
    {
      field: 'lastCheck',
      headerName: 'Last Check',
      flex: 1,
      minWidth: 140,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>
          {new Date(params?.row?.lastCheck)?.toLocaleString(undefined, {
            timeZoneName: 'short'
          })}
        </span>
      )
    },
    {
      field: 'network',
      headerName: 'Network',
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{getAllNetworks(params.row.indexer)}</span>
      )
    },
    {
      field: 'viewMore',
      headerName: '',
      width: 120,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <Button onClick={() => setSelectedNode(params.row)}>View More</Button>
      ),
      sortable: false
    },
    {
      field: 'publicKey',
      headerName: 'Public Key',
      flex: 1,
      sortable: false,
      minWidth: 200
    },
    {
      field: 'version',
      headerName: 'Version',
      flex: 1,
      minWidth: 100,
      sortable: false
    },
    {
      field: 'http',
      headerName: 'HTTP Enabled',
      flex: 1,
      minWidth: 100,
      sortable: false
    },
    {
      field: 'p2p',
      headerName: 'P2P Enabled',
      flex: 1,
      minWidth: 100,
      sortable: false
    },
    {
      field: 'supportedStorage',
      headerName: 'Supported Storage',
      flex: 1,
      minWidth: 200,
      sortable: false,
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
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatPlatform(params.row.platform)}</span>
      )
    },
    {
      field: 'codeHash',
      headerName: 'Code Hash',
      flex: 1,
      minWidth: 200,
      sortable: false
    },
    {
      field: 'allowedAdmins',
      headerName: 'Allowed Admins',
      flex: 1,
      minWidth: 200,
      sortable: false
    }
  ]

  const countryColumns: GridColDef[] = [
    {
      field: 'country',
      headerName: 'Country',
      flex: 1,
      minWidth: 200,
      align: 'left',
      headerAlign: 'left',
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

  const handleFilterChange = (filterModel: GridFilterModel) => {
    const newFilters: CountryStatsFilters = {}

    filterModel.items.forEach((item) => {
      if (item.value && item.field) {
        const fieldName =
          item.field === 'cityWithMostNodes' ? 'cityWithMostNodesCount' : item.field

        ;(newFilters as any)[fieldName] = {
          value: String(item.value),
          operator: item.operator as FilterOperator
        }
      }
    })

    setFilters(newFilters)
  }

  const handleSearchChange = (searchValue: string) => {
    if (tableType === 'countries') {
      setLocalSearchTermCountry(searchValue)
    } else {
      setLocalSearchTerm(searchValue)
    }
  }

  const handleSearch = () => {
    if (tableType === 'countries') {
      setCountrySearchTerm(searchTermCountry)
    } else {
      setSearchTerm(searchTerm)
    }
  }

  const handleReset = () => {
    if (tableType === 'countries') {
      setCountrySearchTerm('')
    } else {
      setLocalSearchTerm('')
      setLocalSearchTermCountry('')
      setCountrySearchTerm('')
      setSearchTerm('')
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
              onSearch: handleSearch,
              onReset: handleReset,
              tableType: tableType
            }
          }}
          initialState={{
            columns: {
              columnVisibilityModel: {
                network: false,
                publicKey: false,
                version: false,
                http: false,
                p2p: false,
                supportedStorage: false,
                platform: false,
                codeHash: false,
                allowedAdmins: false
              }
            },
            pagination: {
              paginationModel: {
                pageSize: pageSize,
                page: currentPage - 1
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
          onFilterModelChange={handleFilterChange}
          rowCount={totalItems}
          autoHeight={false}
          hideFooter={true}
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
