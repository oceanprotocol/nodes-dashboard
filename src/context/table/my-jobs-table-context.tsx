import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import { FilterOperator, JobsFilters } from '@/types/filters';
import { ComputeJob } from '@/types/jobs';
import { formatDateTime } from '@/utils/formatters';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CtxType = TableContextType<ComputeJob>;

const MyJobsTableContext = createContext<CtxType | undefined>(undefined);

export const MyJobsTableProvider = ({ children, consumer }: { children: ReactNode; consumer: string | undefined }) => {
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

  const buildFilterParams = (filters: JobsFilters): string => {
    const filtersObject: Record<string, { operator: string; value: any }> = {};

    if (!filters || Object.keys(filters).length === 0)
      return `filters=${encodeURIComponent(JSON.stringify(filtersObject))}`;

    Object.entries(filters).forEach(([field, filterData]) => {
      if (filterData?.value !== undefined && filterData?.operator) {
        filtersObject[field] = {
          operator: filterData.operator,
          value: filterData.value,
        };
      }
    });

    return `filters=${encodeURIComponent(JSON.stringify(filtersObject))}`;
  };

  const fetchUrl = useMemo(() => {
    let url = `${getApiRoute('owners')}/${'0x4d7E4E3395074B3fb96eeddc6bA947767c4E1234'}/computeJobs?page=${crtPage}&size=${pageSize}&sort={"createdAt":"desc"}`;
    const gridFilterToJobsFilters = (gridFilter: GridFilterModel): JobsFilters => {
      const jobsFilters: JobsFilters = {};
      gridFilter.items.forEach((item) => {
        if (item.field && item.value !== undefined && item.operator) {
          jobsFilters[item.field as keyof JobsFilters] = {
            value: item.value,
            operator: item.operator as FilterOperator,
          };
        }
      });
      return jobsFilters;
    };
    const filterString = buildFilterParams(gridFilterToJobsFilters(filterModel));
    if (filterString) {
      url += `&${filterString}`;
    }
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    return url;
  }, [consumer, crtPage, filterModel, pageSize, searchTerm]);

  const fetchData = useCallback(async () => {
    if (!consumer) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(fetchUrl);
      const sanitizedData = response.data.computeJobs.map((element: any, index: number) => ({
        ...element,
        id: element.jobId,
        startTime: formatDateTime(element.dateCreated),
        index: (crtPage - 1) * pageSize + index + 1,
      }));

      setData(sanitizedData);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, crtPage, pageSize, consumer]);

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
          // (false);
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
    <MyJobsTableContext.Provider
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
    </MyJobsTableContext.Provider>
  );
};

export const useMyJobsTableContext = () => {
  const context = useContext(MyJobsTableContext);
  if (!context) {
    throw new Error('useMyJobsTableContext must be used within a MyJobsTableProvider');
  }
  return context;
};
