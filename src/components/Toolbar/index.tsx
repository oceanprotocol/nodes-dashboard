import React from 'react'
import {
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarProps
} from '@mui/x-data-grid'
import { TextField, IconButton } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import style from './style.module.css'

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
  onReset
}) => {
  return (
    <GridToolbarContainer className={style.root}>
      <div>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport />
      </div>

      <div style={{}}>
        <TextField
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          variant="outlined"
          size="small"
          style={{ marginLeft: 8 }}
        />
        <IconButton onClick={onSearch} aria-label="search">
          <SearchIcon />
        </IconButton>
        <IconButton onClick={onReset} aria-label="reset">
          <ClearIcon />
        </IconButton>
      </div>
    </GridToolbarContainer>
  )
}

export default CustomToolbar
