import { getApiRoute } from '@/config';
import { MOCK_NODES } from '@/mock/nodes';
import { FilterOperator, NodeFilters } from '@/types/filters';
import { Node } from '@/types/nodes';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type LeaderboardContextType = {
  crtPage: number;
  data: Node[];
  error: any;
  filterModel: GridFilterModel;
  filters: Record<string, any>;
  loading: boolean;
  pageSize: number;
  searchTerm: string;
  sortModel: Record<string, 'asc' | 'desc'>;
  totalItems: number;
  fetchData: () => Promise<void>;
  setCrtPage: (page: LeaderboardContextType['crtPage']) => void;
  setFilterModel: (filter: LeaderboardContextType['filterModel']) => void;
  setFilters: (filters: LeaderboardContextType['filters']) => void;
  setPageSize: (size: LeaderboardContextType['pageSize']) => void;
  setSearchTerm: (term: string) => void;
  setSortModel: (model: LeaderboardContextType['sortModel']) => void;
};

export const LeaderboardContext = createContext<LeaderboardContextType | undefined>(undefined);

export const LeaderboardProvider = ({ children }: { children: ReactNode }) => {
  // TODO - check if nextSearchAfter  needed/used;
  const [crtPage, setCrtPage] = useState<LeaderboardContextType['crtPage']>(1);
  const [data, setData] = useState<LeaderboardContextType['data']>([]);
  const [error, setError] = useState<LeaderboardContextType['error']>(null);
  const [filterModel, setFilterModel] = useState<LeaderboardContextType['filterModel']>({ items: [] });
  const [filters, setFilters] = useState<LeaderboardContextType['filters']>({});
  const [loading, setLoading] = useState<LeaderboardContextType['loading']>(false);
  const [nextSearchAfter, setNextSearchAfter] = useState<any[] | null>(null);
  const [pageSize, setPageSize] = useState<LeaderboardContextType['pageSize']>(100);
  const [searchTerm, setSearchTerm] = useState<LeaderboardContextType['searchTerm']>('');
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({});
  const [totalItems, setTotalItems] = useState<LeaderboardContextType['totalItems']>(0);

  const sortParams = useMemo(() => {
    return Object.entries(sortModel)
      .map(([field, order]) => `sort[${field}]=${order}`)
      .join('&');
  }, [sortModel]);

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
    let url = `${getApiRoute('nodes')}?page=${crtPage}&size=${pageSize}`;
    if (sortParams) {
      url += `&${sortParams}`;
    }
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
  }, [crtPage, pageSize, sortParams, filterModel, searchTerm]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(fetchUrl);
      const sanitizedData = response.data.nodes.map((element: any, index: number) => ({
        ...element._source,
        index: (crtPage - 1) * pageSize + index + 1,
      }));
      // TODO - remove mock data addition
      const dataWithMockFields = sanitizedData.map((node: Node, index: number) => ({
        ...MOCK_NODES[index % MOCK_NODES.length],
        ...node,
      }));
      setData(dataWithMockFields);
      setTotalItems(response.data.pagination.totalItems);
      setNextSearchAfter(response.data.pagination.nextSearchAfter);
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
        // const initialSetupPromises: Promise<any>[] = [];

        // if (!systemStats.cpuCounts || Object.keys(systemStats.cpuCounts).length === 0) {
        //   initialSetupPromises.push(fetchSystemStats());
        // }

        // const isDefaultView =
        //   (!searchTerm || searchTerm.trim() === '') &&
        //   (Object.keys(filters).length === 0 ||
        //     Object.values(filters).every((filter: any) => !filter || !filter.value));

        // if (isDefaultView && !metricsLoaded) {
        //   initialSetupPromises.push(getTotalEligible());
        //   initialSetupPromises.push(getTotalRewards());
        // }

        // initialSetupPromises.push(fetchRewardsHistory());

        // await Promise.all(initialSetupPromises);

        // if (isDefaultView && !metricsLoaded) {
        //   setMetricsLoaded(true);
        // }
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

  const handleSetCrtPage: LeaderboardContextType['setCrtPage'] = (page) => {
    setCrtPage(page);
  };

  const handleSetFilterModel: LeaderboardContextType['setFilterModel'] = (filter) => {
    setFilterModel(filter);
    setCrtPage(1);
  };

  const handleSetFilters: LeaderboardContextType['setFilters'] = (newFilters: { [key: string]: any }) => {
    setFilters(newFilters);
    setCrtPage(1);
  };

  const handleSetPageSize: LeaderboardContextType['setPageSize'] = (size) => {
    setPageSize(size);
    setData([]);
    setNextSearchAfter(null);
  };

  const handleSetSearchTerm: LeaderboardContextType['setSearchTerm'] = (term) => {
    setSearchTerm(term);
    setCrtPage(1);
    setNextSearchAfter(null);
  };

  const handleSetSortModel: LeaderboardContextType['setSortModel'] = (model) => {
    setSortModel(model);
    setCrtPage(1);
    setNextSearchAfter(null);
  };

  return (
    <LeaderboardContext.Provider
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
        setCrtPage: handleSetCrtPage,
        setFilterModel: handleSetFilterModel,
        setFilters: handleSetFilters,
        setPageSize: handleSetPageSize,
        setSearchTerm: handleSetSearchTerm,
        setSortModel: handleSetSortModel,
      }}
    >
      {children}
    </LeaderboardContext.Provider>
  );
};

export const useLeaderboardContext = () => {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error('useLeaderboardContext must be used within a LeaderboardProvider');
  }
  return context;
};
