import React, { JSXElementConstructor, useMemo } from 'react'
import {
  DataGrid,
  GridColDef,
  GridToolbarProps,
  GridValidRowModel,
  useGridApiRef
} from '@mui/x-data-grid'

import styles from './index.module.css'

import NodeDetails from './NodeDetails'
import CustomToolbar from '../Toolbar'
import { styled } from '@mui/material/styles'
import CustomPagination from './CustomPagination'
import { nodeColumns, countryColumns } from './columns'
import { TableTypeEnum } from '../../shared/enums/TableTypeEnum'
import { useTable } from './hooks/useTable'

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

export default function Table({ tableType = TableTypeEnum.NODES }: { tableType?: TableTypeEnum }) {
  const {
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
  } = useTable(tableType)

  const apiRef = useGridApiRef()

  const columns = useMemo(
    () =>
      tableType === TableTypeEnum.NODES
        ? nodeColumns(totalUptime, setSelectedNode)
        : countryColumns,
    [tableType, totalUptime, setSelectedNode]
  )

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
                pageSize:
                  tableType === TableTypeEnum.COUNTRIES ? countryPageSize : pageSize,
                page:
                  (tableType === TableTypeEnum.COUNTRIES
                    ? countryCurrentPage
                    : currentPage) - 1
              }
            },
            density: 'comfortable'
          }}
          pagination
          disableColumnMenu
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{
            page:
              (tableType === TableTypeEnum.COUNTRIES ? countryCurrentPage : currentPage) -
              1,
            pageSize: tableType === TableTypeEnum.COUNTRIES ? countryPageSize : pageSize
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
        page={tableType === TableTypeEnum.COUNTRIES ? countryCurrentPage : currentPage}
        pageSize={tableType === TableTypeEnum.COUNTRIES ? countryPageSize : pageSize}
        totalItems={totalItems}
        onPageChange={(page: number) =>
          tableType === TableTypeEnum.COUNTRIES
            ? setCountryCurrentPage(page)
            : setCurrentPage(page)
        }
        onPageSizeChange={(size: number) =>
          tableType === TableTypeEnum.COUNTRIES
            ? setCountryPageSize(size)
            : setPageSize(size)
        }
      />
      {selectedNode && (
        <NodeDetails nodeData={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}
