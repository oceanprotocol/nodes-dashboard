import { getApiRoute } from '@/config';
import { CHAIN_ID } from '@/constants/chains';
import { getSupportedTokens } from '@/constants/tokens';
import { ApiPaginationResponse } from '@/types/api';
import { NodeEnvironments } from '@/types/environments';
import { EnvironmentsFilters } from '@/types/filters';
import { GPUPopularityDisplay, GPUPopularityStats } from '@/types/nodes';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

const INITIAL_PAGE = 1;
// Server page size. Consumers filter each page client-side (service-on-demand support, supported fee
// token), so a server page can contribute zero visible rows.
const PAGE_SIZE = 20;

export type RawFilters = {
  feeToken?: string | string[];
  free?: boolean;
  network?: string;
  fromMaxJobDuration?: number;
  gpuName?: string[];
  minimumCPU?: number;
  minimumRAM?: number;
  minimumStorage?: number;
};

export const DEFAULT_FILTERS: RawFilters = {
  network: String(CHAIN_ID),
  feeToken: Object.values(getSupportedTokens()).map((t) => t.address),
};

/** Client-side visibility test a consumer applies to each env (service-on-demand, fee token, …).
 *  Passed to `loadMoreEnvs` so the fetch loop can tell a page that contributes nothing visible from
 *  one that does, and keep paging instead of stopping on a page that would render empty. */
export type EnvVisibilityFilter = (env: NodeEnvironments['computeEnvironments']['environments'][number]) => boolean;

type RunJobEnvsContextType = {
  fetchGpus: () => Promise<void>;
  filters: RawFilters;
  filtersUnmetFallback: boolean;
  gpus: GPUPopularityDisplay;
  loading: boolean;
  /** Pages forward until at least one env passing `isVisible` is found, or the last page is reached.
   *  Omit `isVisible` to advance exactly one page. */
  loadMoreEnvs: (isVisible?: EnvVisibilityFilter) => Promise<void>;
  nodeEnvs: NodeEnvironments[];
  paginationResponse: ApiPaginationResponse | null;
  setFilters: (filters: RawFilters) => void;
  setSort: (sort: string) => void;
  sort: string | null;
};

const RunJobEnvsContext = createContext<RunJobEnvsContextType | undefined>(undefined);

export const RunJobEnvsProvider = ({ children }: { children: ReactNode }) => {
  const [crtPage, setCrtPage] = useState(INITIAL_PAGE);
  // Mirrors crtPage for the multi-page load loop, which advances faster than state settles.
  const pageRef = useRef(INITIAL_PAGE);
  const [filters, setFilters] = useState<RawFilters>(DEFAULT_FILTERS);
  const [filtersUnmetFallback, setFiltersUnmetFallback] = useState(false);
  const [gpus, setGpus] = useState<GPUPopularityDisplay>([]);
  const [loading, setLoading] = useState(false);
  const [nodeEnvs, setNodeEnvs] = useState<NodeEnvironments[]>([]);
  const [paginationResponse, setPaginationResponse] = useState<ApiPaginationResponse | null>(null);
  const [sort, setSort] = useState<string>(JSON.stringify({ benchmarkTotalScore: 'desc' }));

  const buildFilterParams = useCallback((rawFilters?: RawFilters) => {
    if (!rawFilters) {
      return undefined;
    }
    const filterParams: EnvironmentsFilters = {};
    if (rawFilters.feeToken) {
      if (Array.isArray(rawFilters.feeToken)) {
        filterParams.feeToken = { operator: 'in', value: rawFilters.feeToken };
      } else {
        filterParams.feeToken = { operator: 'eq', value: rawFilters.feeToken };
      }
    }
    if (rawFilters.network) {
      filterParams.network = { operator: 'eq', value: rawFilters.network };
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
    if (rawFilters.free) {
      filterParams.free = { operator: 'eq', value: rawFilters.free };
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
    }): Promise<{ envs: NodeEnvironments[]; pagination: ApiPaginationResponse } | null> => {
      setLoading(true);
      try {
        const response = await axios.get<{
          envs: NodeEnvironments[];
          fallback?: boolean;
          pagination: ApiPaginationResponse;
        }>(getApiRoute('environments'), {
          params: {
            filters: JSON.stringify(buildFilterParams(filters)),
            page: pageNumber,
            pageSize,
            sort,
          },
        });
        if (response.data) {
          setFiltersUnmetFallback(response.data.fallback ?? false);
          setPaginationResponse(response.data.pagination);
          if (operation === 'load-more') {
            setNodeEnvs((prev) => [...prev, ...response.data.envs]);
          } else {
            setNodeEnvs(response.data.envs);
          }
          return { envs: response.data.envs, pagination: response.data.pagination };
        }
        return null;
      } catch (error) {
        console.error('Failed to fetch environments:', error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [buildFilterParams]
  );

  // Page forward until a page contributes at least one env the caller can actually show, or we hit
  // the last page. Without this, a page whose envs are all filtered out client-side renders as an
  // empty list even though later pages hold matches. The page cursor is tracked in a ref because the
  // loop advances several pages within a single call, faster than state would settle.
  const loadMoreEnvs = useCallback(
    async (isVisible?: EnvVisibilityFilter) => {
      let page = pageRef.current;
      for (;;) {
        page += 1;
        pageRef.current = page;
        setCrtPage(page);
        const result = await fetchEnvironments({
          filters,
          operation: 'load-more',
          pageNumber: page,
          pageSize: PAGE_SIZE,
          sort,
        });
        // Request failed — stop rather than hammering the API; the button stays for a manual retry.
        if (!result) {
          return;
        }
        // No filter supplied: caller just wants the next page.
        if (!isVisible) {
          return;
        }
        const gainedVisible = result.envs.some((node) =>
          node.computeEnvironments.environments.some((env) => isVisible(env))
        );
        if (gainedVisible || page >= result.pagination.totalPages) {
          return;
        }
      }
    },
    [fetchEnvironments, filters, sort]
  );

  useEffect(() => {
    setCrtPage(INITIAL_PAGE);
    pageRef.current = INITIAL_PAGE;
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
        filtersUnmetFallback,
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
