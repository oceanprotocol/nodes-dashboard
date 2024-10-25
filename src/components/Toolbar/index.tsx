import React from 'react'
import {
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarProps
} from '@mui/x-data-grid'
import { TextField, IconButton, styled } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import style from './style.module.css'

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#CF1FB11A',
    borderRadius: '20px',
    '& fieldset': {
      borderColor: 'transparent'
    },
    '&:hover fieldset': {
      borderColor: 'transparent'
    },
    '&.Mui-focused fieldset': {
      borderColor: 'transparent'
    }
  },
  '& .MuiInputBase-input': {
    fontFamily: 'Sharp Sans, sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '21px',
    textAlign: 'left'
  }
})

interface CustomToolbarProps extends GridToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onReset: () => void
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onSearch,
  onReset,
  ...props
}) => {
  return (
    <GridToolbarContainer className={style.root}>
      <div className={style.buttons}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport style={{ color: '#3f51b5' }} />
      </div>

      <div className={style.search}>
        <StyledTextField
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              onSearch()
            }
          }}
          placeholder="Search..."
          variant="outlined"
          size="small"
          InputProps={{
            endAdornment: (
              <>
                <IconButton onClick={onSearch} size="small">
                  <SearchIcon style={{ color: '#CF1FB1' }} />
                </IconButton>
                {searchTerm && (
                  <IconButton onClick={onReset} size="small">
                    <ClearIcon style={{ color: '#CF1FB1' }} />
                  </IconButton>
                )}
              </>
            ),
            style: { paddingRight: '8px' }
          }}
        />
      </div>
    </GridToolbarContainer>
  )
}

export default CustomToolbar
