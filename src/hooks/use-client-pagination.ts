import { useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 25;
export const MIN_PAGE_SIZE = 10;

export const useClientPagination = <T>(items: T[]) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    changePageSize,
    hasPagination: items.length > MIN_PAGE_SIZE,
    page,
    pageItems,
    pageSize,
    resetPage: () => setPage(1),
    setPage,
  };
};
