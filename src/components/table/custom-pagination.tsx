import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Pagination, styled, Typography, useMediaQuery, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import styles from './custom-pagination.module.css';

const StyledPagination = styled(Pagination)(({ theme }) => ({
  '& .MuiPaginationItem-root': {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: '16px',
    fontWeight: 400,
  },
  '& .MuiPaginationItem-page': {
    minWidth: '32px',
    height: '32px',
    borderRadius: '8px',
    padding: '3px 8px',
    '&.MuiPaginationItem-page.Mui-selected': {
      backgroundColor: 'var(--accent1)',
      color: 'var(--text-primary-inverse)',
    },
  },
}));

interface CustomPaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const CustomPagination = React.memo(function CustomPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: CustomPaginationProps) {
  const [pageInput, setPageInput] = useState('');
  const totalPages = Math.ceil(totalItems / pageSize);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handlePageChange = useCallback(
    (event: React.ChangeEvent<unknown>, value: number) => {
      onPageChange(value);
    },
    [onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (event: any) => {
      onPageSizeChange(Number(event.target.value));
    },
    [onPageSizeChange]
  );

  const handlePageJump = () => {
    const newPage = parseInt(pageInput);
    if (!isNaN(newPage) && newPage > 0 && newPage <= totalPages) {
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('page', String(newPage));
      window.history.replaceState(null, '', `?${searchParams.toString()}`);

      onPageChange(newPage);
    }
    setPageInput('');
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlPage = searchParams.get('page');
    if (urlPage) {
      const parsedPage = parseInt(urlPage);
      if (!isNaN(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages) {
        if (parsedPage !== page) {
          onPageChange(parsedPage);
        }
        setPageInput(String(parsedPage));
      }
    }
  }, [onPageChange, page, totalPages]);

  if (isMobile) {
    return (
      <div className={styles.pagination}>
        <div className={styles.mobileArrowsRow}>
          <Button
            className={styles.paginationButton}
            color="accent1"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ArrowBackIcon />
          </Button>
          <Typography className={styles.pageInfo}>
            Page {page} of {totalPages}
          </Typography>
          <Button
            className={styles.paginationButton}
            color="accent1"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ArrowForwardIcon />
          </Button>
        </div>
        <div className={styles.controlsRow}>
          <Select
            value={pageSize}
            onChange={handlePageSizeChange}
            options={[10, 25, 50, 100].map((size) => ({
              label: String(size),
              value: size,
            }))}
            size="sm"
          />
          <div className={styles.controlsRow}>
            <Input
              max={totalPages}
              min={1}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder="Page"
              size="sm"
              type="number"
              value={pageInput}
              onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
            />
            <Button color="accent1" onClick={handlePageJump} variant="filled">
              Go
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pagination}>
      <Button
        color="accent1"
        contentBefore={<ArrowBackIcon />}
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        variant="transparent"
      >
        Previous
      </Button>
      <div className={styles.paginationCore}>
        <StyledPagination
          color="primary"
          count={totalPages}
          page={page}
          onChange={handlePageChange}
          shape="rounded"
          hidePrevButton
          hideNextButton
        />
        <div className={styles.controlsRow}>
          <Select
            value={pageSize}
            onChange={handlePageSizeChange}
            options={[10, 25, 50, 100].map((size) => ({
              label: String(size),
              value: size,
            }))}
            size="sm"
          />
          <Input
            max={totalPages}
            min={1}
            onChange={(e) => setPageInput(e.target.value)}
            placeholder="Page"
            size="sm"
            type="number"
            value={pageInput}
            onKeyDown={(e) => e.key === 'Enter' && handlePageJump()}
          />
          <Button color="accent1" onClick={handlePageJump} variant="filled">
            Go
          </Button>
        </div>
      </div>
      <Button
        color="accent1"
        contentAfter={<ArrowForwardIcon />}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        variant="transparent"
      >
        Next
      </Button>
    </div>
  );
});

export default CustomPagination;
