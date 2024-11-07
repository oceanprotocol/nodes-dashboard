import React from 'react'
import { Pagination, styled, Button, Typography, Select, MenuItem } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import styles from './CustomPagination.module.css'

const StyledPagination = styled(Pagination)(({ theme }) => ({
  '& .MuiPaginationItem-root': {
    color: '#000000',
    fontFamily: 'Sharp Sans, sans-serif',
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '16px',
    paddingTop: '3px'
  },
  '& .MuiPaginationItem-page.Mui-selected': {
    backgroundColor: '#CF1FB1',
    color: '#FFFFFF',
    '&:hover': {
      backgroundColor: '#CF1FB1'
    },
    maxWidth: '32px',
    maxHeight: '32px',
    borderRadius: '8px',
    paddingTop: '3px'
  }
}))

const NavButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  padding: '6px',
  '&.Mui-disabled': {
    opacity: 0.5
  }
}))

const StyledSelect = styled(Select)(({ theme }) => ({
  minWidth: 80,
  marginLeft: theme.spacing(2),
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#CF1FB1'
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#CF1FB1'
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#CF1FB1'
  },
  '& .MuiSelect-icon': {
    color: '#CF1FB1'
  },
  '& .MuiSelect-select': {
    paddingTop: 5,
    paddingBottom: 5,
    fontFamily: "'Sharp Sans', sans-serif",
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    color: '#000000'
  },
  '& .MuiMenuItem-root': {
    fontFamily: "'Sharp Sans', sans-serif",
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '16px',
    color: '#000000'
  }
}))

interface CustomPaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

function CustomPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}: CustomPaginationProps) {
  const pageCount = Math.ceil(totalItems / pageSize)

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    onPageChange(value)
  }

  const handlePageSizeChange = (event: any) => {
    onPageSizeChange(event.target.value)
  }

  return (
    <div className={styles.pagination}>
      <NavButton
        className={styles.paginationButton}
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        <ArrowBackIcon style={{ color: '#CF1FB1' }} />
        <Typography className={styles.paginationArrowText}>Previous</Typography>
      </NavButton>
      <div className={styles.paginationCore}>
        <StyledPagination
          color="primary"
          count={pageCount}
          page={page}
          onChange={handlePageChange}
          shape="rounded"
          hidePrevButton
          hideNextButton
        />
        <StyledSelect value={pageSize} onChange={handlePageSizeChange} variant="outlined">
          {[10, 25, 50, 100].map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </StyledSelect>
      </div>
      <NavButton
        className={styles.paginationButton}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
      >
        <Typography className={styles.paginationArrowText}>Next</Typography>
        <ArrowForwardIcon style={{ color: '#CF1FB1' }} />
      </NavButton>
    </div>
  )
}

export default CustomPagination
