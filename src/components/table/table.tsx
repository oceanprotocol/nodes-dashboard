import {
  actionsColumnProps,
  benchmarkJobsColumns,
  jobsColumns,
  nodesLeaderboardColumns,
  nodesLeaderboardHomeColumns,
  nodesTopByJobCountColumns,
  nodesTopByRevenueColumns,
  nodeStorageFilesColumns,
  nodeStorageMyBucketsColumns,
  nodeStorageSharedBucketsColumns,
  unbanRequestsColumns,
} from '@/components/table/columns';
import { TableContextType } from '@/components/table/context-type';
import CustomPagination from '@/components/table/custom-pagination';
import CustomToolbar from '@/components/table/custom-toolbar';
import { TableTypeEnum } from '@/components/table/table-type';
import styled from '@emotion/styled';
import { LinearProgress } from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridFilterModel,
  GridInitialState,
  GridRenderCellParams,
  GridRowIdGetter,
  GridRowParams,
  GridSortModel,
  GridValidRowModel,
  useGridApiRef,
} from '@mui/x-data-grid';
import { GridSlotsComponentsProps } from '@mui/x-data-grid/internals';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
  minWidth: 0,
});

const StyledActionsWrapper = styled('div')({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'row',
  gap: 4,
  height: '100%',
});

const StyledDataGridWrapper = styled('div')<{ autoHeight?: boolean }>(({ autoHeight }) => ({
  height: autoHeight ? 'auto' : 'calc(100dvh - 200px)',
  width: '100%',
  '@media (max-width: 600px)': {
    height: autoHeight ? 'auto' : '50dvh',
  },
}));

const StyledScrollWrapper = styled('div')({
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  width: '100%',
});

const StyledDataGrid = styled(DataGrid)<{ clickable?: boolean }>(({ clickable }) => ({
  background: 'none',
  border: 'none',
  minWidth: 600,
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
    // '& .MuiDataGrid-filler': {
    // background: 'rgba(0, 0, 0, 0.03)',

    // '& > div': {
    // borderTop: '1px solid var(--border)',
    // },
    // },

    '& .MuiDataGrid-scrollbarFiller': {
      background: 'transparent',
    },
  },

  '& .MuiDataGrid-row': {
    cursor: clickable ? 'pointer' : 'inherit',
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
    backgroundColor: 'var(--background-glass-secondary)',
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
}));

type TableProps<T extends GridValidRowModel> = {
  autoHeight?: boolean;
  actionsColumn?: GridColDef<T>['renderCell'];
  columns?: GridColDef<T>[];
  context?: TableContextType<T>;
  data?: any[];
  loading?: boolean;
  // TODO internal pagination
  paginationType: 'context' | 'none';
  tableType: TableTypeEnum;
  showToolbar?: boolean;
  getRowId?: GridRowIdGetter<GridValidRowModel>;
  onRowClick?: (params: GridRowParams<T>) => void;
};

export const Table = <T extends GridValidRowModel>({
  autoHeight,
  actionsColumn,
  columns: columnsProp,
  context,
  data: propsData,
  loading: propsLoading,
  paginationType,
  showToolbar,
  tableType,
  getRowId,
  onRowClick,
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

  useEffect(() => {
    if (!actionsColumn) {
      return;
    }
    const id = requestAnimationFrame(() => {
      if (apiRef.current?.autosizeColumns) {
        apiRef.current.autosizeColumns({ columns: ['_actions'], includeHeaders: true });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [actionsColumn, data, apiRef]);

  const columns = useMemo(() => {
    const withActions = <C extends GridColDef>(cols: C[]) =>
      actionsColumn
        ? [
            ...cols,
            {
              ...actionsColumnProps,
              renderCell: (params: GridRenderCellParams<T>) => (
                <StyledActionsWrapper>{actionsColumn(params)}</StyledActionsWrapper>
              ),
            },
          ]
        : cols;

    if (columnsProp) {
      return withActions(columnsProp);
    }
    switch (tableType) {
      case TableTypeEnum.MY_JOBS: {
        return withActions(jobsColumns);
      }
      case TableTypeEnum.UNBAN_REQUESTS: {
        return withActions(unbanRequestsColumns);
      }
      case TableTypeEnum.NODE_STORAGE_FILES: {
        return withActions(nodeStorageFilesColumns);
      }
      case TableTypeEnum.NODE_STORAGE_MY_BUCKETS: {
        return withActions(nodeStorageMyBucketsColumns);
      }
      case TableTypeEnum.NODE_STORAGE_SHARED_BUCKETS: {
        return withActions(nodeStorageSharedBucketsColumns);
      }
      case TableTypeEnum.NODES_LEADERBOARD:
      case TableTypeEnum.MY_NODES: {
        return withActions(nodesLeaderboardColumns);
      }
      case TableTypeEnum.NODES_LEADERBOARD_HOME: {
        return withActions(nodesLeaderboardHomeColumns);
      }
      case TableTypeEnum.NODES_TOP_JOBS: {
        return withActions(nodesTopByJobCountColumns);
      }
      case TableTypeEnum.NODES_TOP_REVENUE: {
        return withActions(nodesTopByRevenueColumns);
      }
      case TableTypeEnum.BENCHMARK_JOBS:
      case TableTypeEnum.BENCHMARK_JOBS_HISTORY: {
        return withActions(benchmarkJobsColumns);
      }
    }
  }, [tableType, actionsColumn, columnsProp]);

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
          context.setSortModel(sort ? { [field]: sort } : {});
        } else {
          context.setSortModel({});
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
    const coreState: GridInitialState = { density: 'standard' };
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

  const slotProps: GridSlotsComponentsProps = {
    basePopper: {
      style: {
        color: '#000000',
      },
    },
    // loadingOverlay: {
    //   variant: 'skeleton',
    //   noRowsVariant: 'skeleton',
    // },
  };

  const defaultGetRowId: GridRowIdGetter<GridValidRowModel> = (row) => row.id;

  return (
    <StyledRoot>
      {showToolbar && (
        <CustomToolbar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onSearch={() => {}}
          onReset={handleResetFilters}
          tableType={tableType}
          apiRef={apiRef.current ?? undefined}
          totalUptime={null}
        />
      )}
      <StyledScrollWrapper>
        <StyledDataGridWrapper autoHeight={autoHeight}>
          <StyledDataGrid
            apiRef={apiRef}
            clickable={!!onRowClick}
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
            onRowClick={onRowClick}
            onSortModelChange={handleSortModelChange}
            pageSizeOptions={[10, 25, 50, 100]}
            // pagination
            paginationMode={paginationType === 'none' ? undefined : 'server'}
            paginationModel={paginationModel}
            processRowUpdate={processRowUpdate}
            rowCount={totalItems}
            rows={data}
            slots={{ loadingOverlay: () => <LinearProgress /> }}
            slotProps={slotProps}
            sortingMode={paginationType === 'none' ? 'client' : 'server'}
          />
        </StyledDataGridWrapper>
      </StyledScrollWrapper>
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
