import { TableContextType } from '@/components/table/context-type';
import { getApiRoute } from '@/config';
import { Node } from '@/types';
import { FilterOperator, MyNodesFilters } from '@/types/filters';
import { GridFilterModel } from '@mui/x-data-grid';
import axios from 'axios';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type CtxType = TableContextType<Node>;

const MyNodesTableContext = createContext<CtxType | undefined>(undefined);

export const MyNodesTableContextProvider = ({
  children,
  ownerId,
}: {
  children: ReactNode;
  ownerId: string | undefined;
}) => {
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

  const buildFilterParams = (filters: MyNodesFilters): string => {
    if (!filters || Object.keys(filters).length === 0) return '';

    const filtersObject: Record<string, { operator: string; value: any }> = {};

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
    if (!ownerId) {
      return '';
    }
    let url = `${getApiRoute('admin')}/${ownerId}/myNodes?page=${crtPage}&size=${pageSize}&sort={"totalScore":"desc"}`;

    const operatorMap: Record<string, FilterOperator> = {
      '>': 'gt',
      '<': 'lt',
      '=': 'eq',
    };

    const gridFilterToBenchmarkFilters = (gridFilter: GridFilterModel): MyNodesFilters => {
      const myNodesFilters: MyNodesFilters = {};
      gridFilter.items.forEach((item) => {
        if (item.field && item.value !== undefined && item.operator) {
          myNodesFilters[item.field as keyof MyNodesFilters] = {
            value: item.value,
            operator: operatorMap[item.operator] || (item.operator as FilterOperator),
          };
        }
      });
      return myNodesFilters;
    };

    const filterString = buildFilterParams(gridFilterToBenchmarkFilters(filterModel));
    if (filterString) {
      url += `&${filterString}`;
    }
    if (searchTerm) {
      url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    return url;
  }, [ownerId, crtPage, pageSize, filterModel, searchTerm]);

  const fetchData = useCallback(async () => {
    if (!ownerId) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(fetchUrl);
      const sanitizedData = response.data.nodes.map((element: any, index: number) => ({
        ...element,
        index: (crtPage - 1) * pageSize + index + 1,
      }));
      setData(sanitizedData);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [crtPage, pageSize, fetchUrl, ownerId]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchAllData = async () => {
      if (!mounted) return;
      try {
        await fetchData();
      } catch (error) {
        console.error('Error fetching initial my nodes data:', error);
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
    <MyNodesTableContext.Provider
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
    </MyNodesTableContext.Provider>
  );
};

export const useMyNodesTableContext = () => {
  const context = useContext(MyNodesTableContext);
  if (!context) {
    throw new Error('useMyNodesTableContext must be used within a MyNodesTableContextProvider');
  }
  return context;
};
