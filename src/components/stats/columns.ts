import { Node } from '@/types/nodes';
import { GridColDef } from '@mui/x-data-grid';

export const topNodesByRevenueColumns: GridColDef<Node>[] = [
  {
    field: 'friendly_name',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: true,
  },
  {
    field: 'region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    sortable: true,
  },
  {
    field: 'total_revenue',
    filterable: false,
    flex: 1,
    headerName: 'Total Revenue',
    sortable: true,
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
  },
];

export const topNodesByJobsColumns: GridColDef<Node>[] = [
    {
    field: 'friendly_name',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: true,
  },
  {
    field: 'region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    sortable: true,
  },
  {
    field: 'total_jobs',
    filterable: false,
    flex: 1,
    headerName: 'Total Jobs',
    sortable: true,
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
  },
];
