import {
  jobsColumns,
  nodesLeaderboardColumns,
  nodesLeaderboardHomeColumns,
  nodesTopByJobCountColumns,
  nodesTopByRevenueColumns,
  topNodesByJobsColumns,
  topNodesByRevenueColumns,
  unbanRequestsColumns,
} from '@/components/table/columns';
import { TableContextType } from '@/components/table/context-type';
import CustomPagination from '@/components/table/custom-pagination';
import CustomToolbar, { CustomToolbarProps } from '@/components/table/custom-toolbar';
import { TableTypeEnum } from '@/components/table/table-type';
import styled from '@emotion/styled';
import {
  DataGrid,
  GridColDef,
  GridFilterModel,
  GridInitialState,
  GridRowIdGetter,
  GridSortModel,
  GridValidRowModel,
  useGridApiRef,
} from '@mui/x-data-grid';
import { GridSlotsComponentsProps, GridToolbarProps } from '@mui/x-data-grid/internals';
import { JSXElementConstructor, useCallback, useMemo, useRef, useState } from 'react';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  overflow: 'hidden',
  width: '100%',
});

const StyledDataGridWrapper = styled('div')<{ autoHeight?: boolean }>(({ autoHeight }) => ({
  height: autoHeight ? 'auto' : 'calc(100vh - 200px)',
  width: '100%',
}));

const StyledDataGrid = styled(DataGrid)({
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  borderRadius: 0,
  color: 'var(--text-primary)',

  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'var(--background-table-header)',
    borderRadius: 0,

    '& .MuiDataGrid-columnHeader, & .MuiDataGrid-filler': {
      background: 'none',
      borderBottomColor: 'var(--border)',

      '& .MuiDataGrid-columnHeaderTitle': {
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: 'normal',
      },

      '& .MuiDataGrid-sortButton': {
        color: 'var(--text-primary)',
      },

      '& .MuiDataGrid-columnSeparator': {
        color: 'var(--border)',
      },
    },
  },

  '& .MuiDataGrid-main': {
    '& .MuiDataGrid-filler': {
      background: 'rgba(0, 0, 0, 0.03)',

      '& > div': {
        borderTop: '1px solid var(--border)',
      },
    },

    '& .MuiDataGrid-scrollbarFiller': {
      background: 'transparent',
    },
  },

  '& .MuiDataGrid-row': {
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--accent1) 7%, transparent 93%);',
    },
  },

  '& .MuiDataGrid-cell': {
    borderTopColor: 'var(--border)',
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

type TableProps<T> = {
  autoHeight?: boolean;
  context?: TableContextType<T>;
  data?: any[];
  loading?: boolean;
  // TODO internal pagination
  paginationType: 'context' | 'none';
  tableType: TableTypeEnum;
  showToolbar?: boolean;
  getRowId?: GridRowIdGetter<GridValidRowModel>;
};

export const Table = <T,>({
  autoHeight,
  context,
  data: propsData,
  loading: propsLoading,
  paginationType,
  showToolbar,
  tableType,
  getRowId,
}: TableProps<T>) => {
  const apiRef = useGridApiRef();

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');

  const loading = propsLoading ?? context?.loading;

  const { currentPage, data, pageSize, totalItems } = useMemo(() => {
    if (paginationType === 'context') {
      return {
        currentPage: context?.crtPage ?? 1,
        data: context?.data ?? [],
        pageSize: context?.pageSize ?? 0,
        totalItems: context?.totalItems ?? 0,
      };
    }
    return {
      currentPage: 1,
      data: propsData ?? [],
      pageSize: propsData?.length ?? 0,
      totalItems: propsData?.length ?? 0,
    };
  }, [paginationType, propsData, context?.crtPage, context?.data, context?.pageSize, context?.totalItems]);

  const columns = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.BENCHMARK_JOBS:
      case TableTypeEnum.MY_JOBS: {
        return jobsColumns;
      }
      case TableTypeEnum.UNBAN_REQUESTS: {
        return unbanRequestsColumns;
      }
      case TableTypeEnum.NODES_LEADERBOARD:
      case TableTypeEnum.MY_NODES: {
        return nodesLeaderboardColumns;
      }
      case TableTypeEnum.NODES_LEADERBOARD_HOME: {
        return nodesLeaderboardHomeColumns;
      }
      case TableTypeEnum.NODES_TOP_JOBS: {
        return nodesTopByJobCountColumns;
      }
      case TableTypeEnum.NODES_TOP_REVENUE: {
        return nodesTopByRevenueColumns;
      }
      case TableTypeEnum.NODES_TOP_JOBS: {
        return topNodesByJobsColumns;
      }
      case TableTypeEnum.NODES_TOP_REVENUE: {
        return topNodesByRevenueColumns;
      }
      case TableTypeEnum.BENCHMARK_JOBS_HISTORY: {
        return jobsColumns;
      }
    }
  }, [tableType]);

  const handlePaginationChange = useCallback(
    (model: { page: number; pageSize: number }) => {
      if (paginationType === 'context' && context) {
        context.setCrtPage(model.page);
        context.setPageSize(model.pageSize);
      }
    },
    [context, paginationType]
  );

  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
      if (paginationType === 'context' && context) {
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
    [context, paginationType]
  );

  const handleFilterModelChange = useCallback(
    (model: GridFilterModel) => {
      if (paginationType === 'context' && context) {
        context.setFilterModel(model);
      }
    },
    [context, paginationType]
  );

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    if (paginationType === 'context' && context) {
      const emptyFilter: GridFilterModel = { items: [] };
      context.setFilterModel(emptyFilter);
      if (context.setSearchTerm) {
        context.setSearchTerm('');
      }
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    }
  }, [context, paginationType, setSearchTerm]);

  const handleSearchChange = useCallback(
    (term: string) => {
      setSearchTerm(term);
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      searchTimeout.current = setTimeout(() => {
        if (paginationType === 'context' && context?.setSearchTerm) {
          context.setSearchTerm(term);
        }
      }, 500);
    },
    [context, paginationType, setSearchTerm]
  );

  const processRowUpdate = useCallback((newRow: GridValidRowModel, oldRow: GridValidRowModel): GridValidRowModel => {
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
  }, []);

  const initialState = useMemo(() => {
    const coreState: GridInitialState = { density: 'comfortable' };
    return paginationType === 'none'
      ? coreState
      : {
          ...coreState,
          pagination: {
            paginationModel: {
              pageSize: pageSize,
              page: currentPage - 1,
            },
          },
        };
  }, [currentPage, pageSize, paginationType]);

  const paginationModel =
    paginationType === 'none'
      ? undefined
      : {
          page: currentPage - 1,
          pageSize: pageSize,
        };

  const slotProps: GridSlotsComponentsProps & { toolbar: Partial<CustomToolbarProps> } = {
    basePopper: {
      style: {
        color: '#000000',
      },
    },
    loadingOverlay: {
      variant: 'skeleton',
      noRowsVariant: 'skeleton',
    },
    toolbar: {
      searchTerm,
      onSearchChange: handleSearchChange,
      onReset: handleResetFilters,
      tableType: tableType,
      apiRef: apiRef.current ?? undefined,
      // totalUptime: totalUptime,
    },
  };

  const defaultGetRowId: GridRowIdGetter<GridValidRowModel> = (row) => row.id;

  return (
    <StyledRoot>
      <StyledDataGridWrapper autoHeight={autoHeight}>
        <StyledDataGrid
          apiRef={apiRef}
          columns={columns as GridColDef<GridValidRowModel>[]}
          disableColumnMenu
          disableRowSelectionOnClick
          filterMode={paginationType === 'none' ? 'client' : 'server'}
          getRowId={getRowId ?? defaultGetRowId}
          hideFooter
          initialState={initialState}
          loading={loading ?? context?.loading}
          onFilterModelChange={handleFilterModelChange}
          onPaginationModelChange={handlePaginationChange}
          onSortModelChange={handleSortModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          // pagination
          paginationMode={paginationType === 'none' ? undefined : 'server'}
          paginationModel={paginationModel}
          processRowUpdate={processRowUpdate}
          rowCount={totalItems}
          rows={data}
          showToolbar={showToolbar}
          slots={{ toolbar: CustomToolbar as JSXElementConstructor<GridToolbarProps> }}
          slotProps={slotProps}
          sortingMode={paginationType === 'none' ? 'client' : 'server'}
        />
      </StyledDataGridWrapper>
      {paginationType === 'none' ? null : (
        <CustomPagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={(page: number) => handlePaginationChange({ page, pageSize })}
          onPageSizeChange={(pageSize: number) => handlePaginationChange({ page: currentPage, pageSize })}
        />
      )}
    </StyledRoot>
  );
};
