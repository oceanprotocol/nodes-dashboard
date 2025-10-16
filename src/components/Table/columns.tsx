import { GridColDef, GridFilterInputValue, GridRenderCellParams } from '@mui/x-data-grid'
import { Button, Tooltip } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ReportIcon from '@mui/icons-material/Report'
import { NodeData } from '@/shared/types/RowDataType'
import { formatSupportedStorage, formatPlatform, formatUptimePercentage } from './utils'
import styles from './index.module.css'
import Link from 'next/link'
import HistoryIcon from '@mui/icons-material/History'
import InfoIcon from '@mui/icons-material/Info'

const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <ReportIcon style={{ color: 'orange' }} />
  )
}

const UptimeCell: React.FC<{
  uptimeInSeconds: number
  totalUptime: number | null
}> = ({ uptimeInSeconds, totalUptime }) => {
  if (totalUptime === null) {
    return <span>Loading...</span>
  }

  return <span>{formatUptimePercentage(uptimeInSeconds, totalUptime)}</span>
}

export const nodeColumns = (
  totalUptime: number | null,
  setSelectedNode: (node: NodeData) => void
): GridColDef[] => [
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
    minWidth: 200,
    sortable: false,
    filterable: false,
    renderCell: (params: GridRenderCellParams<NodeData>) => {
      const networks = params.row.provider?.map((p) => p.network).join(', ') || ''
      return <span>{networks}</span>
    }
  },
  {
    field: 'actions',
    headerName: 'Actions',
    sortable: false,
    width: 130,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params: GridRenderCellParams<NodeData>) => {
      const node = params.row
      return (
        <div className={styles.actionButtons}>
          <Tooltip title="View Node Details" arrow>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedNode(node)}
              className={styles.actionButton}
            >
              <InfoIcon fontSize="small" />
            </Button>
          </Tooltip>

          <Tooltip title="View Node History" arrow>
            <Link href={`/history?id=${encodeURIComponent(node.id)}`} passHref>
              <Button variant="outlined" size="small" className={styles.actionButton}>
                <HistoryIcon fontSize="small" />
              </Button>
            </Link>
          </Tooltip>
        </div>
      )
    },
    cellClassName: styles.actionCell
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

export const nodeLeaderboardColumns: GridColDef[] = [
  {
    align: 'center',
    field: 'index', // TODO
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false
  },
  {
    field: 'name', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: false
  },
  {
    field: 'region', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Region',
    sortable: false
  },
  {
    field: 'eligible', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Reward eligibility',
    sortable: false,
    renderCell: (params: GridRenderCellParams<NodeData>) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getEligibleCheckbox(params.row.eligible)}
        <span>{params.row.eligible ? 'Eligible' : 'Not Eligible'}</span>
      </div>
    )
  },
  {
    field: 'latestBenchmarkResults.gpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPU Score',
    sortable: false
  },
  {
    field: 'latestBenchmarkResults.cpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: false
  },
  {
    field: 'latestBenchmarkResults.bandwidth', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth',
    sortable: false
  },
  {
    field: 'gpus', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false
  }
]

export const countryColumns: GridColDef[] = [
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

export const historyColumns: GridColDef[] = [
  {
    field: 'round',
    headerName: 'Round no.',
    flex: 0.5,
    minWidth: 100,
    align: 'left',
    headerAlign: 'left',
    renderCell: (params: GridRenderCellParams<any>) => {
      return params?.row?.round ?? '-'
    }
  },
  {
    field: 'timestamp',
    headerName: 'Timestamp',
    flex: 1,
    minWidth: 180,
    align: 'left',
    headerAlign: 'left',
    renderCell: (params: GridRenderCellParams<any, number>) => {
      if (params.value == null) {
        return '-'
      }
      try {
        const date = new Date(params.value)
        const hours = String(date.getUTCHours()).padStart(2, '0')
        const minutes = String(date.getUTCMinutes()).padStart(2, '0')
        const seconds = String(date.getUTCSeconds()).padStart(2, '0')
        return `${hours}:${minutes}:${seconds} UTC`
      } catch (e) {
        console.error('Error formatting timestamp:', e)
        return 'Invalid Date'
      }
    }
  },
  {
    field: 'errorCause',
    headerName: 'Reason for Issue',
    flex: 1,
    minWidth: 200,
    align: 'left',
    headerAlign: 'left',
    renderCell: (params: GridRenderCellParams<any>) => {
      return params?.row?.errorCause || '-'
    }
  },
  {
    field: 'derivedStatus',
    headerName: 'Status',
    flex: 0.5,
    minWidth: 120,
    align: 'left',
    headerAlign: 'left',
    sortable: false,
    renderCell: (params: GridRenderCellParams<any>) => {
      const hasError = !!params?.row?.errorCause
      const statusText = hasError ? 'Failed' : 'Success'
      const color = hasError ? '#FF4444' : '#4CAF50'

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: color
            }}
          />
          <span>{statusText}</span>
        </div>
      )
    }
  }
]
