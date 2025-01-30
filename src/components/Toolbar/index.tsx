import React from 'react'
import {
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarProps,
  GridApi
} from '@mui/x-data-grid'
import { TextField, IconButton, styled, Button } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import style from './style.module.css'
import { exportToCsv } from '../Table/utils'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { TableTypeEnum } from '../../shared/enums/TableTypeEnum'
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
  tableType: TableTypeEnum
  apiRef?: GridApi
  totalUptime: number | null
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onSearch,
  onReset,
  apiRef,
  tableType,
  totalUptime
}) => {
  const handleExport = () => {
    console.log('Export clicked')
    console.log('apiRef available:', !!apiRef)
    if (apiRef) {
      exportToCsv(apiRef, tableType, totalUptime)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && searchTerm) {
      event.preventDefault()
      onSearchChange(searchTerm)
    }
  }

  return (
    <GridToolbarContainer className={style.root}>
      <div className={style.buttons}>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <Button
          color="inherit"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          size="small"
        >
          Export
        </Button>
      </div>

      <div className={style.search}>
        <StyledTextField
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search..."
          variant="outlined"
          size="small"
          InputProps={{
            endAdornment: (
              <>
                <IconButton onClick={onSearch} size="small">
                  <SearchIcon />
                </IconButton>
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
    </GridToolbarContainer>
  )
}

export default CustomToolbar
