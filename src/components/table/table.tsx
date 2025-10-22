import { nodesLeaderboardColumns } from '@/components/table/columns';
import { TableContextType } from '@/components/table/context-type';
import CustomPagination from '@/components/table/custom-pagination';
import CustomToolbar, { CustomToolbarProps } from '@/components/table/custom-toolbar';
import { TableTypeEnum } from '@/components/table/table-type';
import styled from '@emotion/styled';
import { DataGrid, GridFilterModel, GridSortModel, GridValidRowModel, useGridApiRef } from '@mui/x-data-grid';
import { GridToolbarProps } from '@mui/x-data-grid/internals';
import { JSXElementConstructor, useCallback, useMemo, useRef, useState } from 'react';

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
        whiteSpace: 'normal',
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

// type TableWithContext<T> = {
//   source: 'context';
//   context: TableContextType<T>;
// };

// type TableWithoutContext<T> = {
//   source: 'props';
//   currentPage?: number;
//   data?: T[];
//   loading?: boolean;
//   pageSize?: number;
//   totalItems?: number;
//   tableType: TableTypeEnum;
//   onPaginationChange?: (page: number, pageSize: number) => void;
// };

type TableProps<T> = {
  context?: TableContextType<T>;
  currentPage?: number;
  data?: any[];
  loading?: boolean;
  pageSize?: number;
  totalItems?: number;
  tableType: TableTypeEnum;
  onPaginationChange?: (page: number, pageSize: number) => void;
};

// type TableProps = TableWithContext | TableWithoutContext;

export const Table = <T,>({
  context,
  currentPage: propCurrentPage,
  data: propsData,
  loading: propsLoading,
  pageSize: propPageSize,
  totalItems: propTotalItems,
  tableType,
  onPaginationChange,
}: TableProps<T>) => {
  const apiRef = useGridApiRef();

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');

  const data = propsData ?? context?.data ?? [];
  const loading = propsLoading ?? context?.loading;

  const currentPage = propCurrentPage ?? context?.crtPage ?? 1;
  const pageSize = propPageSize ?? context?.pageSize ?? 10;
  const totalItems = propTotalItems ?? context?.totalItems ?? 0;

  const columns = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD: {
        return nodesLeaderboardColumns;
      }
    }
  }, [tableType]);

  const handlePaginationChange = useCallback(
    (model: { page: number; pageSize: number }) => {
      if (onPaginationChange) {
        onPaginationChange(model.page, model.pageSize);
      }
      if (context) {
        context.setCrtPage(model.page);
        context.setPageSize(model.pageSize);
      }
    },
    [context, onPaginationChange]
  );

  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
      if (context) {
        if (model.length > 0) {
          const { field, sort } = model[0];
          const filterModel: GridFilterModel = {
            items: [
              {
                id: 1,
                field,
                operator: 'sort',
                value: sort,
              },
            ],
          };
          context.setFilterModel(filterModel);
        }
      }
    },
    [context]
  );

  const handleFilterModelChange = useCallback(
    (model: GridFilterModel) => {
      if (context) {
        context.setFilterModel(model);
      }
    },
    [context]
  );

  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    },
    [setSearchTerm]
  );

  const handleResetFilters = useCallback(() => {
    if (context) {
      setSearchTerm('');
      const emptyFilter: GridFilterModel = { items: [] };
      context.setFilterModel(emptyFilter);
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    }
  }, [context]);

  const customToolbarProps: Partial<CustomToolbarProps> = {
    searchTerm,
    onSearchChange: handleSearchChange,
    onReset: handleResetFilters,
    tableType: tableType,
    apiRef: apiRef.current ?? undefined,
    // totalUptime: totalUptime,
  };

  return (
    <StyledRoot>
      <StyledDataGridWrapper>
        <StyledDataGrid
          apiRef={apiRef}
          columns={columns}
          disableColumnMenu
          disableRowSelectionOnClick
          filterMode="server"
          getRowId={(row) => row.id}
          hideFooter
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
            density: 'comfortable',
            pagination: {
              paginationModel: {
                pageSize: pageSize,
                page: currentPage - 1,
              },
            },
          }}
          loading={loading ?? context?.loading}
          onFilterModelChange={handleFilterModelChange}
          onPaginationModelChange={handlePaginationChange}
          onSortModelChange={handleSortModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          pagination
          paginationMode="server"
          paginationModel={{
            page: currentPage - 1,
            pageSize: pageSize,
          }}
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
          rowCount={totalItems}
          rows={data}
          showToolbar
          slots={{ toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps> }}
          slotProps={{
            basePopper: {
              style: {
                color: '#000000',
              },
            },
            loadingOverlay: {
              variant: 'skeleton',
              noRowsVariant: 'skeleton',
            },
            toolbar: customToolbarProps,
          }}
          sortingMode="server"
        />
      </StyledDataGridWrapper>
      <CustomPagination
        page={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={(page: number) => handlePaginationChange({ page, pageSize })}
        onPageSizeChange={(pageSize: number) => handlePaginationChange({ page: currentPage, pageSize })}
      />
    </StyledRoot>
  );
};
