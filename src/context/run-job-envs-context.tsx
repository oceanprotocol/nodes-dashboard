import { getApiRoute } from '@/config';
import { ApiPaginationResponse } from '@/types/api';
import { NodeEnvironments } from '@/types/environments';
import { EnvironmentsFilters } from '@/types/filters';
import { GPUPopularityDisplay, GPUPopularityStats } from '@/types/nodes';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const INITIAL_PAGE = 1;
const PAGE_SIZE = 10;

export type RawFilters = {
  feeToken?: string;
  fromMaxJobDuration?: number;
  gpuName?: string[];
  minimumCPU?: number;
  minimumRAM?: number;
  minimumStorage?: number;
};

type RunJobEnvsContextType = {
  fetchGpus: () => Promise<void>;
  filters: RawFilters;
  gpus: GPUPopularityDisplay;
  loading: boolean;
  loadMoreEnvs: () => Promise<void>;
  nodeEnvs: NodeEnvironments[];
  paginationResponse: ApiPaginationResponse | null;
  setFilters: (filters: RawFilters) => void;
  setSort: (sort: string | null) => void;
  sort: string | null;
};

const RunJobEnvsContext = createContext<RunJobEnvsContextType | undefined>(undefined);

export const RunJobEnvsProvider = ({ children }: { children: ReactNode }) => {
  const [crtPage, setCrtPage] = useState(INITIAL_PAGE);
  const [filters, setFilters] = useState<RawFilters>({});
  const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);
  const [loading, setLoading] = useState(false);
  const [nodeEnvs, setNodeEnvs] = useState<NodeEnvironments[]>([]);
  const [paginationResponse, setPaginationResponse] = useState<ApiPaginationResponse | null>(null);
  const [sort, setSort] = useState<string | null>(null);

  const buildFilterParams = useCallback((rawFilters?: RawFilters) => {
    if (!rawFilters) {
      return undefined;
    }
    const filterParams: EnvironmentsFilters = {};
    if (rawFilters.feeToken) {
      filterParams.feeToken = { operator: 'eq', value: rawFilters.feeToken };
    }
    if (rawFilters.fromMaxJobDuration || rawFilters.fromMaxJobDuration === 0) {
      filterParams.fromMaxJobDuration = { operator: 'gte', value: rawFilters.fromMaxJobDuration };
    }
    if (rawFilters.gpuName && rawFilters.gpuName.length > 0) {
      filterParams.gpuName = { operator: 'in', value: JSON.stringify(rawFilters.gpuName) };
    }
    if (rawFilters.minimumCPU || rawFilters.minimumCPU === 0) {
      filterParams.minimumCPU = { operator: 'gte', value: rawFilters.minimumCPU };
    }
    if (rawFilters.minimumRAM || rawFilters.minimumRAM === 0) {
      filterParams.minimumRAM = { operator: 'gte', value: rawFilters.minimumRAM };
    }
    if (rawFilters.minimumStorage || rawFilters.minimumStorage === 0) {
      filterParams.minimumStorage = { operator: 'gte', value: rawFilters.minimumStorage };
    }
    return filterParams;
  }, []);

  const fetchEnvironments = useCallback(
    async ({
      filters,
      operation,
      pageNumber,
      pageSize,
      sort,
    }: {
      filters?: RawFilters;
      operation: 'new-search' | 'load-more';
      pageNumber: number;
      pageSize: number;
      sort: string | null;
    }) => {
      setLoading(true);
      try {
        const response = await axios.get<{ envs: NodeEnvironments[]; pagination: ApiPaginationResponse }>(
          getApiRoute('environments'),
          {
            params: {
              filters: JSON.stringify(buildFilterParams(filters)),
              page: pageNumber,
              pageSize,
              sort,
            },
          }
        );
        if (response.data) {
          setPaginationResponse(response.data.pagination);
          if (operation === 'load-more') {
            setNodeEnvs((prev) => [...prev, ...response.data.envs]);
          } else {
            setNodeEnvs(response.data.envs);
          }
        }
      } catch (error) {
        console.error('Failed to fetch environments:', error);
      } finally {
        setLoading(false);
      }
    },
    [buildFilterParams]
  );

  const loadMoreEnvs = useCallback(async () => {
    const newPage = crtPage + 1;
    setCrtPage(newPage);
    await fetchEnvironments({
      filters,
      operation: 'load-more',
      pageNumber: newPage,
      pageSize: PAGE_SIZE,
      sort,
    });
  }, [crtPage, fetchEnvironments, filters, sort]);

  useEffect(() => {
    setCrtPage(INITIAL_PAGE);
    fetchEnvironments({
      filters,
      operation: 'new-search',
      pageNumber: INITIAL_PAGE,
      pageSize: PAGE_SIZE,
      sort,
    });
  }, [fetchEnvironments, filters, sort]);

  // TODO fetch all GPUs not only top 5
  const fetchGpus = useCallback(async () => {
    try {
      const response = await axios.get<GPUPopularityStats>(getApiRoute('gpuPopularity'));
      const res: GPUPopularityDisplay = response.data.map((gpu) => ({
        gpuName: `${gpu.vendor} ${gpu.name}`,
        popularity: gpu.popularity,
      }));
      setGpus(res);
    } catch (error) {
      console.error('Failed to fetch GPUs:', error);
    }
  }, []);

  return (
    <RunJobEnvsContext.Provider
      value={{
        fetchGpus,
        filters,
        gpus,
        loading,
        loadMoreEnvs,
        nodeEnvs,
        paginationResponse,
        setFilters,
        setSort,
        sort,
      }}
    >
      {children}
    </RunJobEnvsContext.Provider>
  );
};

export const useRunJobEnvsContext = () => {
  const context = useContext(RunJobEnvsContext);
  if (!context) {
    throw new Error('useRunJobEnvsContext must be used within a RunJobEnvsProvider');
  }
  return context;
};
