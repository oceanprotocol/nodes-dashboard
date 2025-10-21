import { nodesLeaderboardColumns } from '@/components/table/columns';
import CustomPagination from '@/components/table/custom-pagination';
import CustomToolbar, { CustomToolbarProps } from '@/components/table/custom-toolbar';
import { TableTypeEnum } from '@/components/table/table-type';
import { useTable } from '@/components/table/use-table';
import styled from '@emotion/styled';
import { DataGrid, GridValidRowModel, useGridApiRef } from '@mui/x-data-grid';
import { GridToolbarProps } from '@mui/x-data-grid/internals';
import { JSXElementConstructor, useMemo } from 'react';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  overflow: 'hidden',
  width: '100%',
});

const StyledDataGridWrapper = styled('div')({
  height: 'calc(100vh - 200px)',
  width: '100%',
});

const StyledDataGrid = styled(DataGrid)({
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border-glass)',
  borderRadius: 0,
  color: 'var(--text-primary)',

  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'var(--background-glass-opaque)',
    borderRadius: 0,

    '& .MuiDataGrid-columnHeader, & .MuiDataGrid-filler': {
      background: 'none',
      borderBottomColor: 'var(--border-glass)',

      '& .MuiDataGrid-columnHeaderTitle': {
        fontSize: 14,
        fontWeight: 600,
      },

      '& .MuiDataGrid-columnSeparator': {
        color: 'var(--border-glass)',
      },
    },
  },

  '& .MuiDataGrid-row': {
    '&:hover': {
      backgroundColor: 'var(--background-glass)',
    },
  },

  '& .MuiDataGrid-cell': {
    borderTopColor: 'var(--border-glass)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 14,
  },

  '& .MuiDataGrid-overlay': {
    // backgroundColor: 'rgba(0, 0, 0, 0.3)',
    background: 'none',
  },

  '& .MuiLinearProgress-root': {
    backgroundColor: 'var(--background-glass)',

    '& .MuiLinearProgress-bar': {
      backgroundColor: 'var(--accent1)',
    },
  },

  '& .MuiSkeleton-root': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

type TableProps = {
  currentPage?: number;
  data?: any[];
  loading?: boolean;
  pageSize?: number;
  totalItems?: number;
  tableType: TableTypeEnum;
  onPaginationChange?: (page: number, pageSize: number) => void;
};

export const Table = ({
  currentPage: propCurrentPage,
  data: propsData,
  loading: propsLoading,
  pageSize: propPageSize,
  totalItems: propTotalItems,
  tableType,
  onPaginationChange,
}: TableProps) => {
  const {
    data: hookData,
    loading: hookLoading,
    currentPage: hookCurrentPage,
    pageSize: hookPageSize,
    totalItems: hookTotalItems,
    searchTerm,
    handlePaginationChange,
    handleSortModelChange,
    handleFilterModelChange,
    handleSearchChange,
    handleReset,
  } = useTable(tableType);

  const apiRef = useGridApiRef();

  const data = propsData || hookData;
  const loading = propsLoading || hookLoading;

  const currentPage = propCurrentPage || hookCurrentPage;
  const pageSize = propPageSize || hookPageSize;
  const totalItems = propTotalItems || hookTotalItems;

  const columns = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD: {
        return nodesLeaderboardColumns;
      }
    }
  }, [tableType]);

  const handlePaginationModelChange = (model: { page: number; pageSize: number }) => {
    if (onPaginationChange) {
      onPaginationChange(model.page + 1, model.pageSize);
    } else {
      handlePaginationChange(model);
    }
  };

  const customToolbarProps: Partial<CustomToolbarProps> = {
    searchTerm,
    onSearchChange: handleSearchChange,
    onReset: handleReset,
    tableType: tableType,
    apiRef: apiRef.current ?? undefined,
    // totalUptime: totalUptime,
  };

  return (
    <StyledRoot>
      <StyledDataGridWrapper>
        <StyledDataGrid
          rows={data || []}
          columns={columns}
          slots={{ toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps> }}
          slotProps={{
            toolbar: customToolbarProps,
            loadingOverlay: {
              variant: 'skeleton',
              noRowsVariant: 'skeleton',
            },
            basePopper: {
              style: {
                color: '#000',
              },
            },
          }}
          initialState={{
            columns: {
              columnVisibilityModel:
                tableType === TableTypeEnum.NODES_LEADERBOARD
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
                      country: false,
                    }
                  : {},
            },
            pagination: {
              paginationModel: {
                pageSize: pageSize,
                page: currentPage - 1,
              },
            },
            density: 'comfortable',
          }}
          pagination
          disableColumnMenu
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{
            page: currentPage - 1,
            pageSize: pageSize,
          }}
          showToolbar
          onPaginationModelChange={handlePaginationModelChange}
          loading={loading}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          onSortModelChange={handleSortModelChange}
          onFilterModelChange={handleFilterModelChange}
          rowCount={totalItems}
          hideFooter
          processRowUpdate={(newRow: GridValidRowModel, oldRow: GridValidRowModel): GridValidRowModel => {
            const processCell = (value: unknown) => {
              if (typeof value === 'object' && value !== null) {
                if ('dns' in value || 'ip' in value) {
                  const dnsIpObj = value as { dns?: string; ip?: string; port?: string };
                  return `${dnsIpObj.dns || dnsIpObj.ip}${dnsIpObj.port ? ':' + dnsIpObj.port : ''}`;
                }

                if ('city' in value || 'country' in value) {
                  const locationObj = value as { city?: string; country?: string };
                  return `${locationObj.city} ${locationObj.country}`;
                }
              }
              return value;
            };

            return Object.fromEntries(
              Object.entries(newRow).map(([key, value]) => [key, processCell(value)])
            ) as GridValidRowModel;
          }}
          apiRef={apiRef}
        />
      </StyledDataGridWrapper>
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
            : (size: number) => handlePaginationChange({ page: currentPage - 1, pageSize: size })
        }
      />
    </StyledRoot>
  );
};
