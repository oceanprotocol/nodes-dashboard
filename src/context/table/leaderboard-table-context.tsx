import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import { FilterOperator, NodeFilters } from '@/types/filters';
import { BanStatusResponse, Node } from '@/types/nodes';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CtxType = TableContextType<Node>;

const LeaderboardTableContext = createContext<CtxType | undefined>(undefined);

export const LeaderboardTableProvider = ({ children }: { children: ReactNode }) => {
  const [crtPage, setCrtPage] = useState<CtxType['crtPage']>(1);
  const [data, setData] = useState<CtxType['data']>([]);
  const [error, setError] = useState<CtxType['error']>(null);
  const [filterModel, setFilterModel] = useState<CtxType['filterModel']>({ items: [] });
  const [filters, setFilters] = useState<CtxType['filters']>({});
  const [loading, setLoading] = useState<CtxType['loading']>(false);
  const [pageSize, setPageSize] = useState<CtxType['pageSize']>(100);
  const [searchTerm, setSearchTerm] = useState<CtxType['searchTerm']>('');
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({});
  const [totalItems, setTotalItems] = useState<CtxType['totalItems']>(0);

  const buildFilterParams = (filters: NodeFilters): string => {
    if (!filters || Object.keys(filters).length === 0) return '';
    return Object.entries(filters)
      .filter(([_, filterData]) => filterData?.value && filterData?.operator)
      .map(([field, filterData]) => {
        if (field === 'id') {
          const ids = filterData.value.split(',').map((id: string) => id.trim());
          return `filters[${field}][value]=${ids.join(',')}`;
        }
        return `filters[${field}][${filterData.operator}]=${filterData.value}`;
      })
      .join('&');
  };

  const fetchUrl = useMemo(() => {
    let url = `${getApiRoute('nodes')}?page=${crtPage}&size=${pageSize}&sort[latestBenchmarkResults.gpuScore]=desc`;
    const gridFilterToNodeFilters = (gridFilter: GridFilterModel): NodeFilters => {
      const nodeFilters: NodeFilters = {};
      gridFilter.items.forEach((item) => {
        if (item.field && item.value !== undefined && item.operator) {
          nodeFilters[item.field as keyof NodeFilters] = {
            value: item.value,
            operator: item.operator as FilterOperator,
          };
        }
      });
      return nodeFilters;
    };
    const filterString = buildFilterParams(gridFilterToNodeFilters(filterModel));
    if (filterString) {
      url += `&${filterString}`;
    }
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    return url;
  }, [crtPage, pageSize, filterModel, searchTerm]);

  async function getNodeBanStatus(nodeId: string): Promise<BanStatusResponse> {
    const res = await axios.get(`${getApiRoute('banStatus')}/${nodeId}/banStatus`, {
      timeout: 1_500,
    });

    return { nodeId, ...res.data };
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(fetchUrl);
      const sanitizedData = response.data.nodes.map((element: any, index: number) => ({
        ...element._source,
        index: (crtPage - 1) * pageSize + index + 1,
      }));

      /* TODO: The flow for banned could be improved by having the "banned"
       * status saved directly on the node and returned in the response, so we
       * don't have to perform multiple GET /banStatus requests at this point.
       */
      const possiblyBannedNodes = sanitizedData.filter(
        (item: Node) =>
          item.eligible === false &&
          item.eligibilityCauseStr !== 'No peer data' &&
          item.eligibilityCauseStr !== 'Invalid status response'
      );
      const promises = [];
      for (const node of possiblyBannedNodes) {
        promises.push(getNodeBanStatus(node.id));
      }
      const results = await Promise.all(promises);
      results.forEach((result) => {
        if (result.banned) {
          const currentNodeIndex = sanitizedData.findIndex((item: Node) => item.id === result.nodeId);
          sanitizedData[currentNodeIndex] = {
            ...sanitizedData[currentNodeIndex],
            eligibilityCauseStr: 'Banned',
            banInfo: result.banInfo,
          };
        }
      });

      setData(sanitizedData);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [crtPage, fetchUrl, pageSize]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchAllData = async () => {
      if (!mounted) return;
      try {
        await fetchData();
      } catch (error) {
        console.error('Error fetching initial leaderboard data:', error);
      } finally {
        if (mounted) {
          // setOverallDashboardLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fetchData]);

  const handleSetFilterModel: CtxType['setFilterModel'] = (filter) => {
    setFilterModel(filter);
    setCrtPage(1);
  };

  const handleSetFilters: CtxType['setFilters'] = (newFilters: { [key: string]: any }) => {
    setFilters(newFilters);
    setCrtPage(1);
  };

  const handleSetPageSize: CtxType['setPageSize'] = (size) => {
    setPageSize(size);
    setData([]);
  };

  const handleSetSearchTerm: CtxType['setSearchTerm'] = (term) => {
    setSearchTerm(term);
    setCrtPage(1);
  };

  const handleSetSortModel: CtxType['setSortModel'] = (model) => {
    setSortModel(model);
    setCrtPage(1);
  };

  return (
    <LeaderboardTableContext.Provider
      value={{
        crtPage,
        data,
        fetchData,
        error,
        filterModel,
        filters,
        loading,
        pageSize,
        searchTerm,
        sortModel,
        totalItems,
        setCrtPage,
        setFilterModel: handleSetFilterModel,
        setFilters: handleSetFilters,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
      }}
    >
      {children}
    </LeaderboardTableContext.Provider>
  );
};

export const useLeaderboardTableContext = () => {
  const context = useContext(LeaderboardTableContext);
  if (!context) {
    throw new Error('useLeaderboardTableContext must be used within a LeaderboardTableProvider');
  }
  return context;
};
