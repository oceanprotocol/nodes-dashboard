import React from 'react'
import { GridToolbarContainer, GridToolbarProps } from '@mui/x-data-grid'
import { Button, IconButton, styled, TextField } from '@mui/material'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import FilterListIcon from '@mui/icons-material/FilterList'
import DensityMediumIcon from '@mui/icons-material/DensityMedium'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import style from './CustomToolbar.module.css'
import { ClearIcon } from '@mui/x-date-pickers'

const StyledGridToolbarContainer = styled(GridToolbarContainer)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(1, 2),
  gap: theme.spacing(2)
}))

const StyledButton = styled(Button)(() => ({
  color: '#CF1FB1',
  textTransform: 'uppercase',
  fontWeight: 'bold',
  '&:hover': {
    backgroundColor: 'transparent'
  }
}))

interface CustomToolbarProps extends GridToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onReset: () => void
  tableType: 'nodes' | 'countries'
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onSearch,
  onReset
}) => {
  return (
    <StyledGridToolbarContainer>
      <StyledButton startIcon={<ViewColumnIcon />}>Columns</StyledButton>
      <StyledButton startIcon={<FilterListIcon />}>Filters</StyledButton>
      <StyledButton startIcon={<DensityMediumIcon />}>Density</StyledButton>
      <StyledButton startIcon={<FileDownloadIcon />}>Export</StyledButton>

      <div className={style.search}>
        <TextField
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          variant="outlined"
          size="small"
          InputProps={{
            endAdornment: (
              <>
                <IconButton onClick={onSearch} size="small"></IconButton>
                {searchTerm && (
                  <IconButton onClick={onReset} size="small">
                    <ClearIcon />
                  </IconButton>
                )}
              </>
            )
          }}
        />
      </div>
    </StyledGridToolbarContainer>
  )
}

export default CustomToolbar
