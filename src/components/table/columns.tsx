import InfoButton from '@/components/button/info-button';
import JobInfoButton from '@/components/button/job-info-button';
import { BenchmarkJobHistory, ComputeJob } from '@/types/jobs';
import { GPUPopularity, Node } from '@/types/nodes';
import { UnbanRequest } from '@/types/unban-requests';
import { formatNumber } from '@/utils/formatters';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Tooltip } from '@mui/material';
import { getGridNumericOperators, getGridStringOperators, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import classNames from 'classnames';

function getEligibleCheckbox(eligible = false, eligibilityCauseStr?: string) {
  if (eligible) {
    return (
      <>
        <CheckCircleOutlinedIcon style={{ fill: 'var(--success-darker)' }} />
        <span>Eligible</span>
      </>
    );
  } else {
    switch (eligibilityCauseStr) {
      case 'Invalid status response':
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
            <span>Not eligible</span>
          </>
        );

      case 'Banned':
        return (
          <>
            <HighlightOffOutlinedIcon style={{ fill: 'var(--error-darker)' }} />
            <span>Banned</span>
          </>
        );

      case 'No peer data':
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
            <span>Not eligible</span>
          </>
        );

      default:
        return (
          <>
            <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
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
          <ErrorOutlineOutlinedIcon style={{ fill: 'var(--warning-darker)' }} />
          <span>Pending</span>
        </>
      );

    default:
      return (
        <>
          <HighlightOffOutlinedIcon style={{ fill: 'var(--error-darker)' }} />
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
    field: 'gpus',
    filterable: false,
    flex: 1,
    headerName: 'GPUs',
    sortable: false,
    renderCell: (params) => params.value?.map((gpu: GPUPopularity) => `${gpu.vendor} ${gpu.name}`).join(', ') ?? '-',
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

export const nodesLeaderboardHomeColumns: GridColDef<Node>[] = [
  {
    field: 'friendlyName',
    filterable: true,
    flex: 1,
    headerName: 'Name',
    sortable: false,
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
    field: 'latestBenchmarkResults.totalScore',
    filterable: false,
    flex: 1,
    headerName: 'Bench score',
    sortable: false,
    valueGetter: (_value, row) => row.latestBenchmarkResults?.totalScore || 0,
  },
  {
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Total jobs',
    sortable: false,
    valueGetter: (_value, row) => row.totalJobs || 0,
  },
  {
    field: 'totalRevenue',
    filterable: false,
    flex: 1,
    headerName: 'Revenue',
    sortable: false,
    valueGetter: (_value, row) => `USDC ${row.totalRevenue || 0}`,
  },
];

export const nodesTopByRevenueColumns: GridColDef<Node>[] = [
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
    flex: 1,
    headerName: 'Revenue',
    sortable: false,
    valueGetter: (_value, row) => `USDC ${row.totalRevenue || 0}`,
  },
  {
    field: 'latestTotalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestTotalScore || 0,
  },
];

export const nodesTopByJobCountColumns: GridColDef<Node>[] = [
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
    field: 'totalJobs',
    filterable: false,
    flex: 1,
    headerName: 'Number of jobs',
    sortable: false,
    valueGetter: (_value, row) => row.totalJobs || 0,
  },
  {
    field: 'latestTotalScore',
    filterable: false,
    flex: 1,
    headerName: 'Total Score',
    sortable: false,
    valueGetter: (_value, row) => row.latestTotalScore || 0,
  },
];

export const jobsColumns: GridColDef<ComputeJob>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ value, row }) => {
      if (!value) return '-';
      switch (value) {
        case 'pending':
          return <span className="chip chipWarning">Pending</span>;
        case 'running':
          return <span className="chip chipWarning">Running</span>;
        case 'completed':
          return <span className="textSuccessDarker">Completed</span>;
        case 'failed':
          return (
            <span className="textBold textErrorDarker">
              Failed
              {'errorMessage' in row && row.errorMessage ? (
                <>
                  {' '}
                  <Tooltip title={row.errorMessage}>
                    <InfoOutlinedIcon />
                  </Tooltip>
                </>
              ) : null}
            </span>
          );
        case 'timeout':
          return <span className="textBold textErrorDarker">Timed out</span>;
        default:
          return value;
      }
    },
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
    field: 'amountPaid',
    filterable: true,
    flex: 1,
    headerName: 'Amount Paid',
    sortable: false,
    valueGetter: (_value, row) => row.payment?.cost,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatNumber(value);
    },
  },
  {
    field: 'algoDuration',
    filterable: true,
    flex: 1,
    headerName: 'Duration',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      if (value < 60) return `${value.toFixed(2)}s`;
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    },
  },
  {
    align: 'right',
    field: 'actions',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Actions',
    sortable: false,
    renderCell: (params: GridRenderCellParams<ComputeJob>) => {
      return <JobInfoButton job={params.row} />;
    },
  },
];

export const benchmarkJobsColumns: GridColDef<BenchmarkJobHistory>[] = [
  {
    align: 'center',
    field: 'index',
    filterable: false,
    headerAlign: 'center',
    headerName: 'Index',
    sortable: false,
  },
  {
    field: 'statusText',
    filterable: false,
    flex: 1,
    headerName: 'Status',
    sortable: false,
    renderCell: ({ value, row }) => {
      if (!value) return '-';
      switch (value) {
        case 'pending':
          return <span className="chip chipWarning">Pending</span>;
        case 'running':
          return <span className="chip chipWarning">Running</span>;
        case 'completed':
          return <span className="textSuccessDarker">Completed</span>;
        case 'failed':
          return (
            <span className="textBold textErrorDarker">
              Failed
              {'errorMessage' in row && row.errorMessage ? (
                <>
                  {' '}
                  <Tooltip title={row.errorMessage}>
                    <InfoOutlinedIcon />
                  </Tooltip>
                </>
              ) : null}
            </span>
          );
        case 'timeout':
          return <span className="textBold textErrorDarker">Timed out</span>;
        default:
          return value;
      }
    },
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
    field: 'amountPaid',
    filterable: true,
    flex: 1,
    headerName: 'Amount Paid',
    sortable: false,
    valueGetter: (_value, row) => row.paymentInfo?.cost,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatNumber(value);
    },
  },
  {
    field: 'algoDuration',
    filterable: true,
    flex: 1,
    headerName: 'Duration',
    sortable: false,
    filterOperators: getGridNumericOperators().filter(
      (operator) => operator.value === '=' || operator.value === '>' || operator.value === '<'
    ),
    renderCell: ({ value }) => {
      if (!value) return '-';
      if (value < 60) return `${value.toFixed(2)}s`;
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    },
  },
  {
    field: 'gpuScore',
    filterable: false,
    flex: 1,
    headerName: 'Bench. GPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.gpuScore,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value);
    },
  },
  {
    field: 'cpuScore',
    filterable: false,
    flex: 1,
    headerName: 'Bench. CPU Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.cpuScore,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return Math.round(value);
    },
  },
  {
    field: 'bandwidthScore',
    filterable: false,
    flex: 1,
    headerName: 'Bench. Bandwidth Score',
    sortable: false,
    valueGetter: (_value, row) => row.benchmarkResults?.bandwidthScore,
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
