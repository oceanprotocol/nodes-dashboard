import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import {
  buildOptimisticRow,
  clearOptimisticJob,
  type OptimisticJobSeed,
  readOptimisticJob,
} from '@/lib/optimistic-job';
import { FilterOperator, JobsFilters } from '@/types/filters';
import { ComputeJob } from '@/types/jobs';
import { formatDateTime } from '@/utils/formatters';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// How long to keep polling the indexer for the just-submitted job before giving up on the
// optimistic row (the indexer normally catches up within a few seconds).
const OPTIMISTIC_POLL_INTERVAL_MS = 5000;
const OPTIMISTIC_MAX_POLLS = 12;

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
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({ dateCreated: 'desc' });
  const [totalItems, setTotalItems] = useState<CtxType['totalItems']>(0);
  // A just-submitted job we show optimistically until the indexer reports it (see lib/optimistic-job).
  const [optimisticJob, setOptimisticJob] = useState<OptimisticJobSeed | null>(null);

  const buildFilterParams = (filters: JobsFilters): string => {
    const filtersObject: Record<string, { operator: string; value: any }> = {};
    if (!filters || Object.keys(filters).length === 0) {
      return JSON.stringify(filtersObject);
    }
    Object.entries(filters).forEach(([field, filterData]) => {
      if (filterData?.value !== undefined && filterData?.operator) {
        filtersObject[field] = {
          operator: filterData.operator,
          value: filterData.value,
        };
      }
    });
    return JSON.stringify(filtersObject);
  };

  const fetchParams: Record<string, string> = useMemo(() => {
    const fetchParams: Record<string, string> = {
      page: crtPage.toString(),
      size: pageSize.toString(),
      sort: sortModel ? JSON.stringify(sortModel) : JSON.stringify({}),
    };
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
      fetchParams.filters = filterString;
    }
    if (searchTerm) {
      fetchParams.search = encodeURIComponent(searchTerm);
    }
    return fetchParams;
  }, [crtPage, filterModel, pageSize, searchTerm, sortModel]);

  const fetchData = useCallback(async () => {
    if (!consumer) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${getApiRoute('owners')}/${consumer}/computeJobs`, { params: fetchParams });
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
  }, [consumer, fetchParams, crtPage, pageSize]);

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

  // Adopt a just-submitted job stashed by the run-job flow, but only if it belongs to this consumer.
  useEffect(() => {
    const seed = readOptimisticJob();
    if (!seed) return;
    if (consumer && seed.consumer.toLowerCase() === consumer.toLowerCase()) {
      setOptimisticJob(seed);
    } else {
      clearOptimisticJob();
    }
  }, [consumer]);

  // Once the indexer reports the job, drop the optimistic row.
  useEffect(() => {
    if (optimisticJob && data.some((job) => job.jobId === optimisticJob.jobId)) {
      setOptimisticJob(null);
      clearOptimisticJob();
    }
  }, [data, optimisticJob]);

  // Poll the indexer until the optimistic job shows up (or we hit the cap).
  const pollCountRef = useRef(0);
  useEffect(() => {
    if (!optimisticJob) return;
    pollCountRef.current = 0;
    const interval = setInterval(() => {
      pollCountRef.current += 1;
      fetchData();
      if (pollCountRef.current >= OPTIMISTIC_MAX_POLLS) {
        clearInterval(interval);
        setOptimisticJob(null);
        clearOptimisticJob();
      }
    }, OPTIMISTIC_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [optimisticJob, fetchData]);

  // Show the optimistic row at the top until the fetched data includes it.
  const mergedData = useMemo(() => {
    if (!optimisticJob || data.some((job) => job.jobId === optimisticJob.jobId)) {
      return data;
    }
    return [buildOptimisticRow(optimisticJob), ...data];
  }, [data, optimisticJob]);

  return (
    <MyJobsTableContext.Provider
      value={{
        crtPage,
        data: mergedData,
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
