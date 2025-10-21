import { TableTypeEnum } from '@/components/table/table-type';
import { useLeaderboardContext } from '@/context/leaderboard-context';
import { GridFilterModel, GridSortModel } from '@mui/x-data-grid';
import { useCallback, useMemo, useRef, useState } from 'react';

export const useTable = (tableType: TableTypeEnum) => {
  const {
    crtPage: leaderboardCrtPage,
    data: leaderboardData,
    loading: leaderboardLoading,
    pageSize: leaderboardPageSize,
    totalItems: leaderboardTotalItems,
    setCrtPage: setLeaderboardCrtPage,
    setFilterModel: setLeaderboardFilterModel,
    setPageSize: setLeaderboardPageSize,
  } = useLeaderboardContext();

  // const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const data = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD:
        return leaderboardData;
      default:
        return [];
    }
  }, [leaderboardData, tableType]);

  const loading = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD:
        return leaderboardLoading;
      default:
        return false;
    }
  }, [tableType, leaderboardLoading]);

  const currentPage = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD: {
        return leaderboardCrtPage;
      }
      default:
        return 1;
    }
  }, [tableType, leaderboardCrtPage]);

  const pageSize = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD:
        return leaderboardPageSize;
      default:
        return 10;
    }
  }, [tableType, leaderboardPageSize]);

  const totalItems = useMemo(() => {
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD:
        return leaderboardTotalItems;
      default:
        return 0;
    }
  }, [tableType, leaderboardTotalItems]);

  const handlePaginationChange = useCallback(
    (model: { page: number; pageSize: number }) => {
      switch (tableType) {
        case TableTypeEnum.NODES_LEADERBOARD: {
          setLeaderboardCrtPage?.(model.page + 1);
          setLeaderboardPageSize?.(model.pageSize);
          break;
        }
      }
    },
    [tableType, setLeaderboardCrtPage, setLeaderboardPageSize]
  );

  const handleSortModelChange = useCallback(
    (model: GridSortModel) => {
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

        switch (tableType) {
          case TableTypeEnum.NODES_LEADERBOARD: {
            setLeaderboardFilterModel(filterModel);
            break;
          }
        }
      }
    },
    [tableType, setLeaderboardFilterModel]
  );

  const handleFilterModelChange = useCallback(
    (model: GridFilterModel) => {
      switch (tableType) {
        case TableTypeEnum.NODES_LEADERBOARD: {
          setLeaderboardFilterModel(model);
          break;
        }
      }
    },
    [tableType, setLeaderboardFilterModel]
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

  const handleReset = useCallback(() => {
    setSearchTerm('');
    const emptyFilter: GridFilterModel = { items: [] };
    switch (tableType) {
      case TableTypeEnum.NODES_LEADERBOARD: {
        setLeaderboardFilterModel(emptyFilter);
        break;
      }
    }
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  }, [tableType, setLeaderboardFilterModel, setSearchTerm]);

  return {
    data,
    loading,
    currentPage,
    pageSize,
    totalItems,
    // selectedNode,
    // setSelectedNode,
    searchTerm,
    // totalUptime,
    // nodeId,
    handlePaginationChange,
    handleSortModelChange,
    handleFilterModelChange,
    handleSearchChange,
    handleReset,
  };
};
