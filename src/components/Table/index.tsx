import React, { JSXElementConstructor, useEffect, useState } from 'react'
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridSortModel,
  GridToolbarProps
} from '@mui/x-data-grid'
import styles from './index.module.css'
import { NodeData } from '../../shared/types/RowDataType'
import { useDataContext } from '@/context/DataContext'
import NodeDetails from './NodeDetails'
import { Button, Tooltip } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ReportIcon from '@mui/icons-material/Report';
import CustomToolbar from '../Toolbar'
import axios from 'axios'

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

  const uptimePercentage = (uptimeInSeconds / totalUptime) * 100;
  console.log('real uptime percentage: ', uptimePercentage)
  const percentage = uptimePercentage > 100 ? 100 : uptimePercentage;
  return `${percentage.toFixed(2)}%`;
};

const UptimeCell: React.FC<{ uptimeInSeconds: number, lastCheck: number }> = ({ uptimeInSeconds, lastCheck}) => {
  const [totalUptime, setTotalUptime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTotalUptime = async () => {
      try {
        const response = await axios.get(`https://incentive-backend.oceanprotocol.com/weekStats?date=${(lastCheck/ 1000).toFixed(0)}`);
        const data = response?.data
        if (data && data.length > 0) {
          setTotalUptime(data[0]._source.totalUptime);
        } else {
          throw new Error('Invalid API response');
        }
      } catch (error) {
        setError('Failed to fetch uptime data');
      }
    };

    fetchTotalUptime();
  }, []);

  if (error) {
    return <span>{error}</span>;
  }

  if (totalUptime === null) {
    return <span>Loading...</span>; 
  }

  return <span>{formatUptimePercentage(uptimeInSeconds, totalUptime)}</span>;
};

const getEligibleCheckbox = (eligible: boolean): React.ReactElement => {
  return eligible ? (
    <CheckCircleOutlineIcon style={{ color: 'green' }} />
  ) : (
    <ReportIcon style={{ color: 'orange' }} />
  )
}

export default function Table() {
  const {
    data,
    loading,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    filters,
    setCurrentPage,
    setPageSize,
    setSearchTerm,
    setSortModel,
    setFilters
  } = useDataContext()
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null)
  const [searchTerm, setLocalSearchTerm] = useState<string>('')

  const columns: GridColDef<NodeData>[] = [
    {
      field: 'index',
      renderHeader: () => (
        <Tooltip title="The first 50 after the 4'th epoch ends will receive a soulbound NFT">
          <span>Index</span>
        </Tooltip>
      ),
      width: 20
    },
    {
      field: 'id',
      headerName: 'Node Id',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'uptime',
      headerName: "Weekly Uptime",
      sortable: true,
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <UptimeCell uptimeInSeconds={params.row.uptime} lastCheck={params.row.lastCheck} />
      )
    },
    {
      field: 'dns',
      headerName: 'DNS / IP',
      flex: 1,
      minWidth: 130,
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
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{`${params.row.location?.city || ''} ${params.row.location?.country || ''}`}</span>
      )
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'eligible',
      headerName: 'Last Check Eligibility',
      flex: 1,
      width: 80,
      renderHeader: () => (
        <Tooltip title="These nodes were eligible to receive rewards the proportion of their uptime 
           at the last round checks.">
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
        <span>{new Date(params?.row?.lastCheck)?.toLocaleString(undefined, {
          timeZoneName: 'short'
        })}</span>
      )
    },
    {
      field: 'network',
      headerName: 'Network',
      flex: 1,
      minWidth: 150,
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
      minWidth: 200
    },
    {
      field: 'version',
      headerName: 'Version',
      flex: 1,
      minWidth: 100
    },
    {
      field: 'http',
      headerName: 'HTTP Enabled',
      flex: 1,
      minWidth: 100
    },
    {
      field: 'p2p',
      headerName: 'P2P Enabled',
      flex: 1,
      minWidth: 100
    },
    {
      field: 'supportedStorage',
      headerName: 'Supported Storage',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatSupportedStorage(params.row.supportedStorage)}</span>
      )
    },
    {
      field: 'platform',
      headerName: 'Platform',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<NodeData>) => (
        <span>{formatPlatform(params.row.platform)}</span>
      )
    },
    {
      field: 'codeHash',
      headerName: 'Code Hash',
      flex: 1,
      minWidth: 200
    },
    {
      field: 'allowedAdmins',
      headerName: 'Allowed Admins',
      flex: 1,
      minWidth: 200
    }
  ]

  const handlePaginationChange = (paginationModel: {
    page: number
    pageSize: number
  }) => {
    setCurrentPage(paginationModel.page + 1)
    setPageSize(paginationModel.pageSize)
  }

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    console.log('sorting...')
    if (newSortModel.length > 0) {
      const { field, sort } = newSortModel[0]
      setSortModel({ [field]: sort as 'asc' | 'desc' })
    } else {
      setSortModel({})
    }
  }

  const handleFilterChange = (filterModel: any) => {
    const newFilters: { [key: string]: string } = {}

    filterModel.items.forEach((item: any) => {
      if (item.value && item.field) {
        newFilters[item.field] = String(item.value)
      }
    })

    setFilters({ ...newFilters })
  }

  const handleSearchChange = (searchValue: string) => {
    setLocalSearchTerm(searchValue)
  }

  const handleSearch = () => {
    setSearchTerm(searchTerm)
  }

  const handleReset = () => {
    setLocalSearchTerm('')
    setSearchTerm('')
  }

  return (
    <div className={styles.root}>
      <div style={{ height: '100%', width: '100%' }}>
        <DataGrid
          rows={data}
          columns={columns}
          slots={{
            toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps>
          }}
          slotProps={{
            toolbar: {
              searchTerm: searchTerm,
              onSearchChange: handleSearchChange,
              onSearch: handleSearch,
              onReset: handleReset
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
                allowedAdmins: false,
                // lastCheck: false
              }
            },
            pagination: {
              paginationModel: {
                pageSize: pageSize,
                page: currentPage - 1
              }
            }
          }}
          pagination
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page: currentPage - 1, pageSize }}
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
          autoHeight
        />
      </div>

      {selectedNode && (
        <NodeDetails nodeData={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}
