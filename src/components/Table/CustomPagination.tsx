import React, { useCallback, useState, useEffect } from 'react'
import {
  Pagination,
  styled,
  Button,
  Typography,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
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
    minWidth: '32px',
    height: '32px',
    borderRadius: '8px',
    padding: '3px 8px'
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

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#CF1FB1',
      borderRadius: '4px'
    },
    '&:hover fieldset': {
      borderColor: '#CF1FB1'
    },
    '&.Mui-focused fieldset': {
      borderColor: '#CF1FB1'
    }
  },
  '& .MuiInputBase-input': {
    padding: '5px 12px',
    fontFamily: "'Sharp Sans', sans-serif",
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    color: '#000000'
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#A0AEC0',
    opacity: 1
  },
  '& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button':
    {
      WebkitAppearance: 'none',
      margin: 0
    },
  '& input[type=number]': {
    MozAppearance: 'textfield'
  },
  '& .MuiInputAdornment-root': {
    '& button': {
      color: '#CF1FB1',
      '&:hover': {
        backgroundColor: 'transparent'
      }
    }
  }
}))

interface CustomPaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

const CustomPagination = React.memo(function CustomPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}: CustomPaginationProps) {
  const [pageInput, setPageInput] = useState('')
  const totalPages = Math.ceil(totalItems / pageSize)

  const handlePageChange = useCallback(
    (event: React.ChangeEvent<unknown>, value: number) => {
      onPageChange(value)
    },
    [onPageChange]
  )

  const handlePageSizeChange = useCallback(
    (event: any) => {
      onPageSizeChange(Number(event.target.value))
    },
    [onPageSizeChange]
  )

  const handlePageJump = () => {
    const newPage = parseInt(pageInput)
    if (!isNaN(newPage) && newPage > 0 && newPage <= totalPages) {
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.set('page', String(newPage))
      window.history.replaceState(null, '', `?${searchParams.toString()}`)

      onPageChange(newPage)
    }
    setPageInput('')
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const urlPage = searchParams.get('page')
    if (urlPage) {
      const pageNumber = parseInt(urlPage)
      if (!isNaN(pageNumber) && pageNumber >= 1) {
        setPageInput(String(pageNumber))
      }
    }
  }, [page])

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
          count={totalPages}
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
        <div className={styles.pageJumpContainer}>
          <StyledTextField
            size="small"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            placeholder="Page"
            type="number"
            inputProps={{
              min: 1,
              max: totalPages
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0px',
                      margin: '-4px -8px -4px 0'
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() =>
                        setPageInput(
                          String(Math.min(Number(pageInput || 1) + 1, totalPages))
                        )
                      }
                      sx={{
                        color: '#CF1FB1',
                        padding: '4px 2px 0 2px',
                        '&:hover': { backgroundColor: 'transparent' }
                      }}
                    >
                      <ArrowDropUpIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setPageInput(String(Math.max(Number(pageInput || 1) - 1, 1)))
                      }
                      sx={{
                        color: '#CF1FB1',
                        padding: '0 2px 4px 2px',
                        '&:hover': { backgroundColor: 'transparent' }
                      }}
                    >
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                  </div>
                </InputAdornment>
              )
            }}
            onKeyPress={(e) => e.key === 'Enter' && handlePageJump()}
          />
          <Button
            variant="contained"
            onClick={handlePageJump}
            sx={{
              backgroundColor: '#CF1FB1',
              '&:hover': { backgroundColor: '#A8188D' },
              ml: 1,
              fontFamily: "'Sharp Sans', sans-serif"
            }}
          >
            Go
          </Button>
        </div>
      </div>
      <NavButton
        className={styles.paginationButton}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <Typography className={styles.paginationArrowText}>Next</Typography>
        <ArrowForwardIcon style={{ color: '#CF1FB1' }} />
      </NavButton>
    </div>
  )
})

export default CustomPagination
