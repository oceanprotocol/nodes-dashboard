import { Node } from '@/types/nodes';
import { GridColDef } from '@mui/x-data-grid';

export const nodesLeaderboardColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index', // TODO
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'name', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: true,
  },
  {
    field: 'region', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Region',
    sortable: true,
  },
  {
    field: 'eligible', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Reward eligibility',
    sortable: true,
    // renderCell: (params: GridRenderCellParams<NodeData>) => (
    //   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    //     {getEligibleCheckbox(params.row.eligible)}
    //     <span>{params.row.eligible ? 'Eligible' : 'Not Eligible'}</span>
    //   </div>
    // )
  },
  {
    field: 'latestBenchmarkResults.gpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPU Score',
    sortable: true,
    valueGetter: (_value, row) => row.latestBenchmarkResults.gpuScore,
  },
  {
    field: 'latestBenchmarkResults.cpuScore', // TODO
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: true,
    valueGetter: (_value, row) => row.latestBenchmarkResults.cpuScore,
  },
  {
    field: 'latestBenchmarkResults.bandwidth', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth',
    sortable: true,
    valueGetter: (_value, row) => row.latestBenchmarkResults.bandwidth,
  },
  {
    field: 'gpus', // TODO
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
    renderCell: (params) => params.value.join(', '),
  },
];
