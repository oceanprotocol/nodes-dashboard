import InfoButton from '@/components/button/info-button';
import { GPUPopularity, Node } from '@/types/nodes';
import { UnbanRequest } from '@/types/unban-requests';
import { formatNumber } from '@/utils/formatters';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import { getGridNumericOperators, getGridStringOperators, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import classNames from 'classnames';

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

function getUnbanAttemptResult(result: string) {
  switch (result) {
    case 'Pending':
      return (
        <>
          <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning)' }} />
          <span>Pending</span>
        </>
      );

    default:
      return (
        <>
          <HighlightOffOutlinedIcon style={{ fill: 'var(--error)' }} />
          <span>Failed</span>
        </>
      );
  }
}

function getUnbanAttemptStatus(status: string) {
  return (
    <span
      className={classNames('chip', {
        chipSuccess: status === 'Finished',
        chipWarning: status === 'In queue',
        chipError: status === 'Failed',
      })}
      style={{ alignSelf: 'center' }}
    >
      {status}
    </span>
  );
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
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'latestBenchmarkResults.cpuScore',
    filterable: false,
    flex: 1,
    headerName: 'CPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.cpuScore || 0,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'latestBenchmarkResults.bandwidth',
    filterable: false,
    flex: 1,
    headerName: 'Bandwidth',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.bandwidth || 0,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'latestBenchmarkResults.totalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.totalScore || 0,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
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
      return <InfoButton node={params.row} />;
    },
  },
];

export const jobsColumns: GridColDef<Node>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'status',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
  },
  {
    field: 'startTime',
    filterable: true,
    flex: 1,
    headerName: 'Start Time',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'endTime',
    filterable: true,
    flex: 1,
    headerName: 'End Time',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'difficulty',
    filterable: true,
    flex: 1,
    headerName: 'Difficulty',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'resultHashes',
    filterable: true,
    flex: 1,
    headerName: 'Total hashes',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
  {
    field: 'score',
    filterable: true,
    flex: 1,
    headerName: 'Score',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
  },
];

export const unbanRequestsColumns: GridColDef<UnbanRequest>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'status',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: (params: GridRenderCellParams<UnbanRequest>) => getUnbanAttemptStatus(params.row.status),
  },
  {
    field: 'startedAt',
    filterable: false,
    flex: 1,
    headerName: 'Start Time',
    sortable: false,
  },
  {
    field: 'completedAt',
    filterable: false,
    flex: 1,
    headerName: 'End Time',
    sortable: false,
  },
  {
    field: 'benchmarkResult',
    filterable: false,
    flex: 1,
    headerName: 'Result',
    sortable: false,
    renderCell: (params: GridRenderCellParams<UnbanRequest>) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {getUnbanAttemptResult(params.row.benchmarkResult)}
      </div>
    ),
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
    field: 'friendlyName',
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
    field: 'totalRevenue',
    filterable: false,
    renderCell: ({ value }) => formatNumber(value.toFixed(2)),
    flex: 1,
    headerName: 'Total Revenue',
    sortable: false,
  },
  {
    field: 'latestGpuScore',
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
    field: 'friendlyName',
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
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Total Jobs',
    sortable: true,
  },
  {
    field: 'latestGpuScore',
    filterable: false,
    flex: 1,
    headerName: 'Last benchmark score (GPU)',
    sortable: false,
  },
];
