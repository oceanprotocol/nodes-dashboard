import React, { JSXElementConstructor, useMemo, useEffect } from 'react'
import {
  DataGrid,
  GridColDef,
  GridToolbarProps,
  GridValidRowModel,
  useGridApiRef,
  GridSortModel,
  GridFilterModel
} from '@mui/x-data-grid'
import { useTable } from './hooks/useTable'
import { TableTypeEnum } from '../../shared/enums/TableTypeEnum'
import { nodeColumns, countryColumns, historyColumns } from './columns'
import { styled } from '@mui/material/styles'

import styles from './index.module.css'

import NodeDetails from './NodeDetails'
import CustomToolbar from '../Toolbar'
import CustomPagination from './CustomPagination'

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

interface TableProps {
  data?: any[]
  loading?: boolean
  currentPage?: number
  pageSize?: number
  totalItems?: number
  nodeId?: string
  tableType: TableTypeEnum
  onPaginationChange?: (page: number, pageSize: number) => void
  onSortModelChange?: (model: GridSortModel) => void
  onFilterChange?: (model: GridFilterModel) => void
}

export const Table: React.FC<TableProps> = ({
  data: propsData,
  loading: propsLoading,
  currentPage: propCurrentPage,
  pageSize: propPageSize,
  totalItems: propTotalItems,
  nodeId,
  tableType,
  onPaginationChange,
  onSortModelChange,
  onFilterChange
}) => {
  const {
    data: hookData,
    loading: hookLoading,
    currentPage: hookCurrentPage,
    pageSize: hookPageSize,
    totalItems: hookTotalItems,
    selectedNode,
    setSelectedNode,
    searchTerm,
    searchTermCountry,
    totalUptime,
    handlePaginationChange,
    handleSortModelChange,
    handleFilterChange,
    handleSearchChange,
    handleReset
  } = useTable(tableType)

  const apiRef = useGridApiRef()

  // Add a ref to track previous address
  const prevNodeAddressRef = React.useRef<string>('')

  // Use props data if provided, otherwise use hook data
  const data = propsData || hookData
  const loading = propsLoading || hookLoading
  const currentPage = propCurrentPage || hookCurrentPage
  const pageSize = propPageSize || hookPageSize
  const totalItems = propTotalItems || hookTotalItems

  const columns = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES:
        return nodeColumns(totalUptime, setSelectedNode)
      case TableTypeEnum.COUNTRIES:
        return countryColumns
      case TableTypeEnum.HISTORY:
        return historyColumns
      default:
        return []
    }
  }, [tableType, totalUptime, setSelectedNode])

  useEffect(() => {
    if (nodeId && onFilterChange) {
      onFilterChange({
        items: [
          {
            id: 1,
            field: 'id',
            operator: 'equals',
            value: nodeId
          }
        ]
      })
    }
  }, [nodeId, onFilterChange])

  const handlePaginationModelChange = (model: { page: number; pageSize: number }) => {
    if (onPaginationChange) {
      onPaginationChange(model.page + 1, model.pageSize)
    } else {
      handlePaginationChange(model)
    }
  }

  return (
    <div className={styles.root}>
      <div style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <StyledDataGrid
          rows={data || []}
          columns={columns as GridColDef<GridValidRowModel>[]}
          slots={{
            toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps>
          }}
          slotProps={{
            toolbar: {
              searchTerm:
                tableType === TableTypeEnum.COUNTRIES ? searchTermCountry : searchTerm,
              onSearchChange: handleSearchChange,
              onReset: handleReset,
              tableType: tableType,
              apiRef: apiRef.current,
              totalUptime: totalUptime
            }
          }}
          initialState={{
            columns: {
              columnVisibilityModel:
                tableType === TableTypeEnum.NODES
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
            page: currentPage - 1,
            pageSize: pageSize
          }}
          onPaginationModelChange={handlePaginationModelChange}
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
        page={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={
          onPaginationChange
            ? (page: number) => onPaginationChange(page, pageSize)
            : (page: number) => handlePaginationChange({ page: page - 1, pageSize })
        }
        onPageSizeChange={
          onPaginationChange
            ? (size: number) => onPaginationChange(currentPage, size)
            : (size: number) =>
                handlePaginationChange({ page: currentPage - 1, pageSize: size })
        }
      />
      {selectedNode && (
        <NodeDetails nodeData={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}

export default Table
