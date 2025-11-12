import Button from '@/components/button/button';
import { GPUPopularity, Node } from '@/types/nodes';
import { formatNumber } from '@/utils/formatters';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import { getGridStringOperators, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';

function getEligibleCheckbox(eligible = false, eligibilityCauseStr?: string) {
  if (eligible) {
    return (
      <>
        <CheckCircleOutlinedIcon style={{ fill: 'var(--success)' }} />
        <span>Eligible</span>
      </>
    );
  } else {
    switch (eligibilityCauseStr) {
      case 'Invalid status response':
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning)' }} />
            <span>Not eligible</span>
          </>
        );

      case 'Banned':
        return (
          <>
            <HighlightOffOutlinedIcon style={{ fill: 'var(--error)' }} />
            <span>Banned</span>
          </>
        );

      case 'No peer data':
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning)' }} />
            <span>Not eligible</span>
          </>
        );

      default:
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning)' }} />
            <span>Not eligible</span>
          </>
        );
    }
  }
}

export const nodesLeaderboardColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendlyName',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: false,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'startsWith' || operator.value === 'equals'
    ),
  },
  {
    field: 'location.region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    valueGetter: (_value, row) => row.location?.region,
    sortable: false,
    filterOperators: getGridStringOperators().filter(
      (operator) => operator.value === 'contains' || operator.value === 'startsWith' || operator.value === 'equals'
    ),
  },
  {
    field: 'eligible',
    filterable: true,
    flex: 1,
    headerName: 'Reward eligibility',
    sortable: false,
    renderCell: (params: GridRenderCellParams<Node>) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getEligibleCheckbox(params.row.eligible, params.row.eligibilityCauseStr)}
      </div>
    ),
    filterOperators: getGridStringOperators().filter((operator) => operator.value === 'equals'),
  },
  {
    field: 'latestBenchmarkResults.gpuScore',
    filterable: false,
    flex: 1,
    headerName: 'GPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.gpuScore || 0,
  },
  {
    field: 'latestBenchmarkResults.cpuScore',
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.cpuScore || 0,
  },
  {
    field: 'latestBenchmarkResults.bandwidth',
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.bandwidth || 0,
  },
  {
    field: 'gpus',
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
    renderCell: (params) => params.value?.map((gpu: GPUPopularity) => `${gpu.vendor} ${gpu.name}`).join(', ') ?? '-',
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
    renderCell: (params) => {
      return (
        <Button color="accent1" variant="outlined" href={`/nodes/${params.row.id || params.row.node_id}`}>
          Info
        </Button>
      );
    },
  },
];

export const jobsColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index', // TODO
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'status', // TODO
    filterable: true,
    flex: 1,
    headerName: 'Status',
    sortable: true,
  },
  {
    field: 'startTime', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Start Time',
    sortable: true,
  },
  {
    field: 'endTime', // TODO
    filterable: false,
    flex: 1,
    headerName: 'End Time',
    sortable: true,
  },
  {
    field: 'difficulty', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Difficulty',
    sortable: true,
  },
  {
    field: 'totalHashes', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Total hashes',
    sortable: true,
  },
  {
    field: 'score', // TODO
    filterable: false,
    flex: 1,
    headerName: 'Score',
    sortable: true,
  },
];

export const topNodesByRevenueColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendly_name',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: false,
  },
  {
    field: 'region',
    filterable: true,
    flex: 1,
    headerName: 'Region',
    sortable: false,
  },
  {
    field: 'total_revenue',
    filterable: false,
    renderCell: ({ value }) => formatNumber(value.toFixed(2)),
    flex: 1,
    headerName: 'Total Revenue',
    sortable: false,
  },
  {
    field: 'latest_gpu_score',
    filterable: false,
    flex: 1,
    headerName: 'Last benchmark score (GPU)',
    sortable: false,
  },
];

export const topNodesByJobsColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'friendly_name',
    filterable: false,
    flex: 1,
    headerName: 'Name',
    sortable: true,
  },
  {
    field: 'region',
    filterable: false,
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
    field: 'latest_gpu_score',
    filterable: false,
    flex: 1,
    headerName: 'Last benchmark score (GPU)',
    sortable: false,
  },
];
