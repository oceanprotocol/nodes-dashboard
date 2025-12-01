import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import { BenchmarkJobsHistoryFilters, FilterOperator } from '@/types/filters';
import { ComputeJobHistory } from '@/types/jobs';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CtxType = TableContextType<ComputeJobHistory>;

const BenchmarkJobsHistoryTableContext = createContext<CtxType | undefined>(undefined);

export const BenchmarkJobsHistoryTableProvider = ({ children, nodeId }: { children: ReactNode; nodeId: string }) => {
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

  const buildFilterParams = (filters: BenchmarkJobsHistoryFilters): string => {
    if (!filters || Object.keys(filters).length === 0) return '';
    return Object.entries(filters)
      .filter(([_, filterData]) => filterData?.value && filterData?.operator)
      .map(([field, filterData]) => {
        return `filters[${field}][${filterData.operator}]=${filterData.value}`;
      })
      .join('&');
  };

  const fetchUrl = useMemo(() => {
    let url = `${getApiRoute('benchmarkHistory')}/${nodeId}/benchmarkHistory?page=${crtPage}&size=${pageSize}&sort={"endTime": "desc"}`;
    const gridFilterToBenchmarkFilters = (gridFilter: GridFilterModel): BenchmarkJobsHistoryFilters => {
      const benchmarkFilters: BenchmarkJobsHistoryFilters = {};
      gridFilter.items.forEach((item) => {
        if (item.field && item.value !== undefined && item.operator) {
          benchmarkFilters[item.field as keyof BenchmarkJobsHistoryFilters] = {
            value: item.value,
            operator: item.operator as FilterOperator,
          };
        }
      });
      return benchmarkFilters;
    };
    const filterString = buildFilterParams(gridFilterToBenchmarkFilters(filterModel));
    if (filterString) {
      url += `&${filterString}`;
    }
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    return url;
  }, [crtPage, pageSize, filterModel, searchTerm, nodeId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(fetchUrl);
      const sanitizedData = response.data.benchmarkJobs.map((element: any, index: number) => ({
        ...element,
        score: element.benchmarkResults.gpuScore,
        id: element.jobId,
        index: (crtPage - 1) * pageSize + index + 1,
      }));

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
        console.error('Error fetching initial benchmark jobs history data:', error);
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
    <BenchmarkJobsHistoryTableContext.Provider
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
    </BenchmarkJobsHistoryTableContext.Provider>
  );
};

export const useBenchmarkJobsHistoryTableContext = () => {
  const context = useContext(BenchmarkJobsHistoryTableContext);
  if (!context) {
    throw new Error('useBenchmarkJobsHistoryTableContext must be used within a BenchmarkJobsHistoryTableProvider');
  }
  return context;
};
