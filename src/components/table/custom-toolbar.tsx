import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Menu, { muiMenuPaperStyle } from '@/components/menu/menu';
import { TableTypeEnum } from '@/components/table/table-type';
import { exportToCsv } from '@/components/table/utils';
import ClearIcon from '@mui/icons-material/Clear';
import DensityLargeIcon from '@mui/icons-material/DensityLarge';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SearchIcon from '@mui/icons-material/Search';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { IconButton, ListItemIcon, MenuItem, Popover, styled } from '@mui/material';
import { GridApi, GridColumnsPanel, GridDensity, GridFilterPanel, GridToolbarProps } from '@mui/x-data-grid';
import React, { useState } from 'react';

const StyledRoot = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
});

const StyledButtonsWrapper = styled('div')({
  display: 'flex',
  gap: 16,

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

const StyledPopover = styled(Popover)({
  '& .MuiPaper-root': muiMenuPaperStyle,
});

const StyledGridColumnsPanel = styled(GridColumnsPanel)({
  padding: 12,
});

const StyledGridFilterPanel = styled(GridFilterPanel)({
  '& .MuiDataGrid-panelContent': {
    padding: '14px 0 14px 12px',
  },
  '& .MuiDataGrid-filterForm': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
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
  const [anchorElFilters, setAnchorElFilters] = useState<null | HTMLElement>(null);
  const [anchorElDensity, setAnchorElDensity] = useState<null | HTMLElement>(null);
  const [anchorElColumns, setAnchorElColumns] = useState<null | HTMLElement>(null);

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

  const handleCloseFiltersMenu = () => {
    setAnchorElFilters(null);
  };

  const handleCloseDensityMenu = () => {
    setAnchorElDensity(null);
  };

  const handleCloseColumnsMenu = () => {
    setAnchorElColumns(null);
  };

  const handleSelectDensity = (density: GridDensity) => {
    if (apiRef) {
      apiRef.setDensity(density);
    }
    handleCloseDensityMenu();
  };

  return (
    <StyledRoot>
      <StyledButtonsWrapper>
        <Button
          color="primary"
          contentBefore={<ViewColumnIcon className="textAccent1" />}
          onClick={(e) => setAnchorElColumns(e.currentTarget)}
          size="sm"
          variant="transparent"
        >
          Columns
        </Button>
        <StyledPopover
          anchorEl={anchorElColumns}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          onClose={handleCloseColumnsMenu}
          open={!!anchorElColumns}
        >
          <StyledGridColumnsPanel />
        </StyledPopover>

        <Button
          color="primary"
          contentBefore={<FilterAltIcon className="textAccent1" />}
          onClick={(e) => setAnchorElFilters(e.currentTarget)}
          size="sm"
          variant="transparent"
        >
          Filters
        </Button>
        <StyledPopover
          anchorEl={anchorElFilters}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          onClose={handleCloseFiltersMenu}
          open={!!anchorElFilters}
        >
          <StyledGridFilterPanel />
        </StyledPopover>

        <Button
          color="primary"
          contentBefore={<TableRowsIcon className="textAccent1" />}
          onClick={(e) => setAnchorElDensity(e.currentTarget)}
          size="sm"
          variant="transparent"
        >
          Density
        </Button>
        <Menu
          anchorEl={anchorElDensity}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          onClose={handleCloseDensityMenu}
          open={!!anchorElDensity}
        >
          <MenuItem disableRipple onClick={() => handleSelectDensity('compact')}>
            <ListItemIcon>
              <DensitySmallIcon />
            </ListItemIcon>
            Compact
          </MenuItem>
          <MenuItem disableRipple onClick={() => handleSelectDensity('standard')}>
            <ListItemIcon>
              <DensityMediumIcon />
            </ListItemIcon>
            Standard
          </MenuItem>
          <MenuItem disableRipple onClick={() => handleSelectDensity('comfortable')}>
            <ListItemIcon>
              <DensityLargeIcon />
            </ListItemIcon>
            Comfortable
          </MenuItem>
        </Menu>

        <Button
          color="primary"
          contentBefore={<FileDownloadIcon className="textAccent1" />}
          onClick={handleExport}
          size="sm"
          variant="transparent"
        >
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
