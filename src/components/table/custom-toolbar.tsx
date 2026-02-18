import Input from '@/components/input/input';
import { TableTypeEnum } from '@/components/table/table-type';
import { exportToCsv } from '@/components/table/utils';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import { Button, IconButton, styled, TextField } from '@mui/material';
import {
  GridApi,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
  GridToolbarFilterButton,
  GridToolbarProps,
} from '@mui/x-data-grid';
import React from 'react';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
});

const StyledButtonsWrapper = styled('div')({
  display: 'flex',
  gap: 32,

  '& .MuiButton-root': {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '21px',
    textAlign: 'left',

    '& .MuiSvgIcon-root': {
      color: 'var(--accent1)',
    },
  },
});

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'var(--background-glass)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    paddingRight: 8,

    '& fieldset': {
      border: 'none',
    },

    '&:hover fieldset': {
      border: 'none',
    },

    '&.Mui-focused fieldset': {
      border: 'none',
    },
  },

  '& .MuiInputBase-input': {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: 14,
    fontWeight: 400,
    padding: '4px 16px',
  },

  '& .MuiIconButton-root': {
    color: 'var(--accent1)',
  },
});

export interface CustomToolbarProps extends GridToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  tableType: TableTypeEnum;
  apiRef?: GridApi;
  totalUptime: number | null;
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({
  searchTerm,
  onSearchChange,
  onSearch,
  onReset,
  apiRef,
  tableType,
  totalUptime,
}) => {
  const handleExport = () => {
    if (apiRef) {
      exportToCsv(apiRef, tableType, totalUptime);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && searchTerm) {
      event.preventDefault();
      onSearchChange(searchTerm);
    }
  };

  return (
    <StyledRoot>
      <StyledButtonsWrapper>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <Button color="inherit" startIcon={<FileDownloadIcon />} onClick={handleExport} size="small">
          Export
        </Button>
      </StyledButtonsWrapper>
      <Input
        endAdornment={
          <>
            <IconButton color="primary" onClick={onSearch} size="small">
              <SearchIcon />
            </IconButton>
            {searchTerm && (
              <IconButton color="primary" onClick={onReset} size="small">
                <ClearIcon />
              </IconButton>
            )}
          </>
        }
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Search..."
        type="text"
        size="sm"
        value={searchTerm}
      />
    </StyledRoot>
  );
};

export default CustomToolbar;
