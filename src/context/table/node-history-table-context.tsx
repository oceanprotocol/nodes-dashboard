import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import { useAdminSignature } from '@/lib/use-admin-signature';
import { JOB_STATUS_FILTER_CODES, SERVICE_STATUS_FILTER_CODES, StatusFilterKind } from '@/services/service-status';
import { FilterOperator } from '@/types/filters';
import { NodeJobHistory, NodeServiceHistory } from '@/types/jobs';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type NodeHistoryKind = 'jobs' | 'services';

const KIND_CONFIG = {
  jobs: {
    route: 'nodeComputeJobs',
    path: 'computeJobs',
    responseKey: 'computeJobs',
    idKey: 'jobId',
    statusCodes: JOB_STATUS_FILTER_CODES,
  },
  services: {
    route: 'nodeServices',
    path: 'services',
    responseKey: 'services',
    idKey: 'serviceId',
    statusCodes: SERVICE_STATUS_FILTER_CODES,
  },
} as const;

// Grid operators → backend range operators. Dates use the date column's operators.
const OPERATORS: Record<string, FilterOperator> = {
  '=': 'eq',
  '>': 'gt',
  '<': 'lt',
  is: 'eq',
  onOrAfter: 'gt',
  before: 'lt',
};

// Grid column fields whose backend filter key differs from the field name.
const FILTER_KEYS: Record<string, string> = {
  dateCreated: 'startTime',
  'payment.cost': 'amountPaid',
};

const toBackendFilters = (model: GridFilterModel, statusCodes: Record<StatusFilterKind, number[]>) => {
  const filters: Record<string, { operator: FilterOperator; value: string | number }> = {};
  model.items.forEach((item) => {
    if (!item.field || item.value === undefined || item.value === null || item.value === '') {
      return;
    }
    const operator = OPERATORS[item.operator] ?? (item.operator as FilterOperator);
    if (item.field === 'status') {
      const codes = statusCodes[item.value as StatusFilterKind];
      if (codes?.length) {
        filters.status = { operator, value: codes.join(',') };
      }
      return;
    }
    // The backend takes dates as epoch ms; the grid's date input hands over a Date (or its string).
    const value = item.field === 'dateCreated' ? new Date(item.value).getTime() : item.value;
    if (typeof value === 'number' && Number.isNaN(value)) {
      return;
    }
    filters[FILTER_KEYS[item.field] ?? item.field] = { operator, value };
  });
  return filters;
};

type NodeHistoryRow = NodeJobHistory | NodeServiceHistory;

export type NodeHistoryTableContextType<T extends NodeHistoryRow = NodeHistoryRow> = TableContextType<T> & {
  /** Signs the admin expiry message (one prompt per session) and loads the history. */
  authorize: () => Promise<void>;
  /** Why the backend refused this wallet, if it did. */
  authError: string | null;
  needsAuth: boolean;
};

const NodeHistoryTableContext = createContext<NodeHistoryTableContextType | undefined>(undefined);

export const NodeHistoryTableProvider = ({
  children,
  kind,
  nodeId,
}: {
  children: ReactNode;
  kind: NodeHistoryKind;
  nodeId: string;
}) => {
  const config = KIND_CONFIG[kind];
  const { adminAuth, clearAdminAuth, requestAdminAuth } = useAdminSignature();

  const [authError, setAuthError] = useState<string | null>(null);
  const [crtPage, setCrtPage] = useState<number>(1);
  const [data, setData] = useState<NodeHistoryRow[]>([]);
  const [error, setError] = useState<any>(null);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortModel, setSortModel] = useState<Record<string, 'asc' | 'desc'>>({ dateCreated: 'desc' });
  const [totalItems, setTotalItems] = useState<number>(0);

  const fetchParams = useMemo(() => {
    const params: Record<string, string> = {
      page: crtPage.toString(),
      size: pageSize.toString(),
      sort: JSON.stringify(sortModel ?? {}),
      filters: JSON.stringify(toBackendFilters(filterModel, config.statusCodes)),
    };
    if (searchTerm) {
      params.search = searchTerm;
    }
    return params;
  }, [config.statusCodes, crtPage, filterModel, pageSize, searchTerm, sortModel]);

  const fetchData = useCallback(async () => {
    if (!adminAuth || !nodeId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${getApiRoute(config.route)}/${nodeId}/${config.path}`, {
        params: {
          ...fetchParams,
          address: adminAuth.address,
          expiryTimestamp: adminAuth.expiryTimestamp.toString(),
          signature: adminAuth.signature,
        },
      });
      const rows = (response.data[config.responseKey] ?? []).map((element: any, index: number) => ({
        ...element,
        id: element[config.idKey],
        index: (crtPage - 1) * pageSize + index + 1,
      }));
      setData(rows);
      setTotalItems(response.data.pagination?.totalItems ?? 0);
      setAuthError(null);
    } catch (err) {
      // 403: the backend does not take this wallet as an admin of the node (or the signature went
      // stale). Drop the signature so the next attempt asks for a fresh one.
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        clearAdminAuth();
        setAuthError(err.response?.data?.message ?? 'Not authorized');
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [adminAuth, clearAdminAuth, config, crtPage, fetchParams, nodeId, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const authorize = useCallback(async () => {
    setAuthError(null);
    setError(null);
    try {
      await requestAdminAuth();
    } catch (err) {
      console.error('Admin signature failed:', err);
      setError(err);
    }
  }, [requestAdminAuth]);

  const handleSetFilterModel: TableContextType<NodeHistoryRow>['setFilterModel'] = (filter) => {
    setFilterModel(filter);
    setCrtPage(1);
  };

  const handleSetFilters: TableContextType<NodeHistoryRow>['setFilters'] = (newFilters) => {
    setFilters(newFilters);
    setCrtPage(1);
  };

  const handleSetPageSize: TableContextType<NodeHistoryRow>['setPageSize'] = (size) => {
    setPageSize(size);
    setData([]);
  };

  const handleSetSearchTerm: TableContextType<NodeHistoryRow>['setSearchTerm'] = (term) => {
    setSearchTerm(term);
    setCrtPage(1);
  };

  const handleSetSortModel: TableContextType<NodeHistoryRow>['setSortModel'] = (model) => {
    setSortModel(model);
    setCrtPage(1);
  };

  return (
    <NodeHistoryTableContext.Provider
      value={{
        authError,
        authorize,
        crtPage,
        data,
        error,
        fetchData,
        filterModel,
        filters,
        loading,
        needsAuth: !adminAuth,
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
    </NodeHistoryTableContext.Provider>
  );
};

export const useNodeHistoryTableContext = <T extends NodeHistoryRow>() => {
  const context = useContext(NodeHistoryTableContext);
  if (!context) {
    throw new Error('useNodeHistoryTableContext must be used within a NodeHistoryTableProvider');
  }
  return context as unknown as NodeHistoryTableContextType<T>;
};
