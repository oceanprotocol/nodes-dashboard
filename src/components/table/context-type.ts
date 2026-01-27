import { GridFilterModel } from '@mui/x-data-grid';

export type TableContextType<T> = {
  crtPage: number;
  data: T[];
  error: any;
  filterModel: GridFilterModel;
  filters: Record<string, any>;
  loading: boolean;
  pageSize: number;
  searchTerm: string;
  sortModel: Record<string, 'asc' | 'desc'>;
  totalItems: number;
  fetchData: () => Promise<void>;
  setCrtPage: (page: TableContextType<T>['crtPage']) => void;
  setFilterModel: (filter: TableContextType<T>['filterModel']) => void;
  setFilters: (filters: TableContextType<T>['filters']) => void;
  setPageSize: (size: TableContextType<T>['pageSize']) => void;
  setSearchTerm: (term: string) => void;
  setSortModel: (model: TableContextType<T>['sortModel']) => void;
};
